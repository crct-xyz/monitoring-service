const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const AWS = require("aws-sdk");
const axios = require('axios');

// Solana connection setup
const connection = new Connection(clusterApiUrl('mainnet-beta'));

const sqs = new AWS.SQS({region: 'eu-central-1'})
const queueUrl = 'https://sqs.eu-central-1.amazonaws.com/816069166828/transactionSignatures'

// The Squads multisig PublicKey
const multisigPda = new PublicKey('Gr5FaqkMmypxUJfADQsoYN3moknprc5LzMF2qh3SiP8m');

let lastCheckedSignature = null; // Declare a variable to store the last checked signature

async function sendToSQS(sigInfo) {
    const params = {
        MessageBody: JSON.stringify({
            signature: sigInfo.signature,
            slot: sigInfo.slot,
            confirmationStatus: sigInfo.confirmationStatus
        }),
        QueueUrl: queueUrl,
    };

    try {
        const result = await sqs.sendMessage(params).promise();
        console.log('Message sent to SQS:', result.MessageId);
    } catch (error) {
        console.error('Error sending message to SQS:', error);
    }
}

exports.handler = async (event) => {
    console.log(event);
    console.log("Monitoring transactions...");

    // Fetch signatures for the multisig address
    const signatures = await connection.getSignaturesForAddress(multisigPda, {
        limit: 5,
    });
    console.log(signatures);
    
    for (const sigInfo of signatures) {
        // Check if we've already processed this signature
        if (sigInfo.signature === lastCheckedSignature) {
            console.log("sending sqs")
            await sendToSQS(sigInfo);
            break;
        }
        
        // If the transaction is finalized, process it
        if (sigInfo.confirmationStatus === 'finalized') {
            console.log(`New transaction detected: ${sigInfo.signature}`);
            console.log("sending sqs finalized")
            await sendToSQS(sigInfo);

            // Send the transaction details to the Action Builder service
            // await sendTransactionToActionBuilder(sigInfo);
            // Update lastCheckedSignature to avoid duplicates
            lastCheckedSignature = sigInfo.signature;
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify('Monitoring complete.'),
    };
};

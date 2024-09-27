const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const axios = require('axios');

// Solana connection setup
const connection = new Connection(clusterApiUrl('mainnet-beta'));

// The Squads multisig PublicKey
const multisigPda = new PublicKey('Gr5FaqkMmypxUJfADQsoYN3moknprc5LzMF2qh3SiP8m');

let lastCheckedSignature = null; // Declare a variable to store the last checked signature

exports.handler = async (event) => {
    console.log(event);
    console.log("Monitoring transactions...");

    // Fetch signatures for the multisig address
    const signatures = await connection.getSignaturesForAddress(multisigPda, {
        limit: 5,
    });
    
    for (const sigInfo of signatures) {
        // Check if we've already processed this signature
        if (sigInfo.signature === lastCheckedSignature) {
            break;
        }
        
        // If the transaction is finalized, process it
        if (sigInfo.confirmationStatus === 'finalized') {
            console.log(`New transaction detected: ${sigInfo.signature}`);

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

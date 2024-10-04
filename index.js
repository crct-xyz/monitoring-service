const { Connection, PublicKey, clusterApiUrl } = require("@solana/web3.js");
const crypto = require("crypto");
const axios = require("axios");
const bs58 = require("bs58");
const AWS = require("aws-sdk");

// Solana connection setup
const connection = new Connection(clusterApiUrl('mainnet-beta'));

const sqs = new AWS.SQS({region: 'eu-central-1'})
const queueUrl = 'https://sqs.eu-central-1.amazonaws.com/816069166828/transactionSignatures'
const dbUrl = "http://ec2-52-59-228-70.eu-central-1.compute.amazonaws.com:8000/action_types/";

// The Squads multisig PublicKey
const multisigPda = new PublicKey('Gr5FaqkMmypxUJfADQsoYN3moknprc5LzMF2qh3SiP8m');


async function sendToSQS(transactionType) {
    const params = {
        MessageBody: JSON.stringify({
            TransactionType: transactionType
        }),
        QueueUrl: queueUrl,
    };

    try {
        const result = await sqs.sendMessage(params).promise();
        console.log('Message sent to SQS:', result.MessageId);
        console.log("params: ", params);
    } catch (error) {
        console.error('Error sending message to SQS:', error);
    }
}
function getHash(namespace, name) {
    const preimage = `${namespace}:${name}`;
    const hash = crypto.createHash("sha256").update(preimage).digest();
  
    const sighash = Buffer.alloc(8);
    hash.copy(sighash, 0, 0, 8);
  
    return sighash;
}

const proposalCreateHex = getHash("global", "proposal_create").toString("hex");
const proposalApproveHex = getHash("global", "proposal_approve").toString("hex");
const proposalRejectHex = getHash("global", "proposal_reject").toString("hex");
const vaultTransactionHex = getHash("global", "vault_transaction_create").toString("hex");
const configTransactionHex = getHash("global", "config_transaction_create").toString("hex");

async function getSignatures() {
    let transferType = '';

    try {
      const signatures = await connection.getSignaturesForAddress(multisigPda, {
        limit: 1,
        maxSupportedTransactionVersion: 0, // Add this parameter
      });
      for (const sigInfo of signatures) {
        const tx = await connection.getTransaction(sigInfo.signature, {
          commitment: "finalized",
          maxSupportedTransactionVersion: 0,
        });
        const instructionIndex = tx.meta.innerInstructions[0].index;
        let instructionDataHex = tx.transaction.message.compiledInstructions[instructionIndex].data.slice(0, 8).toString("hex")
        if (instructionDataHex === proposalCreateHex) {
          instructionDataHex = tx.transaction.message.compiledInstructions[instructionIndex + 1].data.slice(0, 8).toString("hex")
        }
        if (instructionDataHex === vaultTransactionHex) {
          transferType = "send"
          return transferType
        }
        else if (instructionDataHex === proposalApproveHex) {
          transferType = "approve_tx"
          return transferType
        }
        else if (instructionDataHex === proposalRejectHex) {
          transferType = "reject_tx"
          return transferType
        }
        else if (instructionDataHex === configTransactionHex) {
          transferType = "config"
          return transferType;
        }
      }
    } catch (error) {
      console.log("error: ", error);
    }
}

exports.handler = async (event) => {
    console.log(event);
    console.log("Monitoring transactions...");

    const transactionType = await getSignatures();

    const response = await axios.get(dbUrl);
    const data = response.data;
    for (item of data) {
        if (item.contract_name === transactionType) {
            await sendToSQS(transactionType)
            console.log("transaction type: ", transactionType, item.type_id)
        }
    };

    return {
        statusCode: 200,
        body: JSON.stringify('Monitoring complete.'),
    };
};

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
const orderDb = 'http://ec2-52-59-228-70.eu-central-1.compute.amazonaws.com:8000/orders/'


// The Squads multisig PublicKey
// const multisigPda = new PublicKey('Gr5FaqkMmypxUJfADQsoYN3moknprc5LzMF2qh3SiP8m');


async function sendToSQS(orderID, actionEvent, userId, transactionType, vaultId, recipients) {
    const params = {
        MessageBody: JSON.stringify({
            Order_ID: orderID,
            Action_Event: actionEvent,
            User_ID: userId,
            Transaction_Type: transactionType,
            Vault_ID: vaultId,
            Recipients: recipients
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

async function getSignatures(multisigPda) {
  console.log("multisigPDA: ", multisigPda);
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
          console.log("transfer Type: ", transferType)
          return transferType
        }
        // biome-ignore lint/style/noUselessElse: <explanation>
        else if (instructionDataHex === proposalApproveHex) {
          transferType = "approve_tx"
          console.log("transfer Type: ", transferType)
          return transferType
        }
        // biome-ignore lint/style/noUselessElse: <explanation>
        else if (instructionDataHex === proposalRejectHex) {
          transferType = "reject_tx"
          console.log("transfer Type: ", transferType)
          return transferType
        }
        // biome-ignore lint/style/noUselessElse: <explanation>
        else if (instructionDataHex === configTransactionHex) {
          transferType = "config"
          console.log("transfer Type: ", transferType)
          return transferType;
        }
      }
    } catch (error) {
      console.log("error: ", error);
    }
}

function parseLambdaEvent(event) {
  // Parse the outer event object
  // const parsedEvent = JSON.parse(event);
  console.log(event);

  // Parse the inner body, which is a stringified JSO

  // Extract the first (and only) transaction from the body
  const transaction = event[0];

  // Extract required information
  const result = {
    innerInstructions: transaction.meta.innerInstructions,
    signatures: transaction.transaction.signatures,
    instructions: transaction.transaction.message.instructions,
    accountKeys: transaction.transaction.message.accountKeys,
  };

  // Log the extracted information
  // console.log("Inner Instructions:");
  // console.log(JSON.stringify(result.innerInstructions, null, 2));

  // console.log("\nSignatures:");
  // result.signatures.forEach((signature, index) => {
  //   console.log(`${index}: ${signature}`);
  // });

  // console.log("\nInstructions:");
  // console.log(JSON.stringify(result.instructions, null, 2));

  // console.log("\nAccount Keys:");
  // result.accountKeys.forEach((key, index) => {
  //   console.log(`${index}: ${key}`);
  // });

  return result;
}

exports.handler = async (event) => {
    console.log(event);
    console.log("Monitoring transactions...");

    // const parsedEventBefore = JSON.parse(event.body);
    // console.log("parsed event: ", parsedEventBefore)
    // const transactionType = await getSignatures();
    // console.log("helius lambda: ", parseLambdaEvent(parsedEventBefore));

    let multisigPda;
    let orderID;
    let actionEvent;
    let userId;
    let transactionType;
    let vaultId;
    let recipients;
    const response = await axios.get(orderDb);
    const data = response.data;
    for (const item of data) {
      if (item.action_event.details.vault_id && item.action_event.details.recipients) {
        vaultId = item.action_event.details.vault_id
        recipients = item.action_event.details.recipients
        orderID = item.order_id
      actionEvent = item.action_event
      userId = item.user_id
        transactionType = await getSignatures(new PublicKey(vaultId))
        await sendToSQS(orderID, actionEvent, userId, transactionType, vaultId, recipients);
      }
      else {
        continue
      }
      // orderID = item.order_id
      // actionEvent = item.action_event
      // userId = item.user_id
      // console.log("userid: ", userId)
      // console.log("recipirents: ", recipients)
    }

    // const {innerInstructions, signatures, instructions, accountKeys} = parseLambdaEvent(parsedEventBefore)
    // console.log("accountkeys: ", accountKeys)

    // const response = await axios.get(dbUrl);
    // const data = response.data;
    // for (item of data) {
    //     if (item.contract_name === transactionType) {
    //         await sendToSQS(transactionType)
    //         console.log("transaction type: ", transactionType, item.type_id)
    //     }
    // };

    return {
        statusCode: 200,
        body: JSON.stringify('Monitoring complete.'),
    };
};

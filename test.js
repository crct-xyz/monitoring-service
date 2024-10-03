const { Connection, PublicKey, clusterApiUrl } = require("@solana/web3.js");
const crypto = require("crypto");
const axios = require("axios");
const bs58 = require('bs58');



dbUrl = 'http://localhost:8000/action_types/'
async function fetchData () {
  try {
      const response = await axios.get(dbUrl);
      const data = response.data;
      data.forEach(item => {
        console.log(item.contract_name);
      });
  }
  catch (error) {
      console.log("error: ", error);
  }
}
fetchData();

// Solana connection setup
const connection = new Connection(clusterApiUrl("mainnet-beta"));

// The Squads multisig PublicKey
const multisigPda = new PublicKey(
  "Gr5FaqkMmypxUJfADQsoYN3moknprc5LzMF2qh3SiP8m"
);

// Function to get signatures for the multisig address
async function getSignatures() {
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
      console.log(tx.meta.innerInstructions)
      console.log("program id: ", tx.transaction.message.getAccountKeys().staticAccountKeys)
      console.log("transsaction", tx.meta.innerInstructions[0])
      const bs58String = tx.transaction.message.instructions[2].data.toString();
      const bs58decoded = bs58.default.decode(bs58String)
      const buffer = Buffer.from(bs58decoded, "base64");
      const first8Bytes = buffer.slice(0,8)
      console.log("first 8 bytes: ", first8Bytes)
      
      // fullTransactionLog = tx.meta.logMessages[5]
      // if (fullTransactionLog === 'Program log: Instruction: ProposalCreate') {
      //   fullTransactionLog = tx.meta.logMessages[11];
      // }
      // transactionLog = fullTransactionLog.substring(fullTransactionLog.lastIndexOf(":") + 1).trim();
      // console.log(transactionLog);
      for (let innerIxs of tx.meta.innerInstructions) {
        let firstIx = innerIxs.instructions[0];
        const instructionData = Buffer.from(firstIx.data, "base64");
        const instructionType = instructionData.slice(0, 8);
        console.log("first ", instructionType);
      }
    }
    function getHash(namespace, name) {
      const preimage = `${namespace}:${name}`;
      const hash = crypto.createHash("sha256").update(preimage).digest();

      const sighash = Buffer.alloc(8); 
      hash.copy(sighash, 0, 0, 8);

      return sighash;
    }
    console.log("globalHash: ", getHash('global', 'vault_transaction_create'));
  } catch (error) {
    console.error("Error fetching signatures:", error);
  }
}

// Call the async function
getSignatures();

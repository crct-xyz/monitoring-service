const { Connection, PublicKey, clusterApiUrl } = require("@solana/web3.js");
const crypto = require("crypto");
const axios = require("axios");
const bs58 = require("bs58");

// fetching data from the api
const dbUrl = "http://ec2-52-59-228-70.eu-central-1.compute.amazonaws.com:8000/action_types/";
// async function fetchData() {
//     let contract_name;
//   try {
//     const response = await axios.get(dbUrl);
//     const data = response.data;
//     data.forEach((item) => {
//       console.log(item.contract_name);
//     });
//   } catch (error) {
//     console.log("error: ", error);
//   }
// }
// fetchData();

// hashing the global namespace instructions
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
console.log("Global hash: ", proposalApproveHex);

const connection = new Connection(clusterApiUrl("mainnet-beta"));
const multisigPda = new PublicKey(
  "Gr5FaqkMmypxUJfADQsoYN3moknprc5LzMF2qh3SiP8m"
);
let transferType = '';
async function getSignatures() {
  try {
    const signatures = await connection.getSignaturesForAddress(multisigPda, {
      limit: 1,
      maxSupportedTransactionVersion: 0, 
    });
    for (const sigInfo of signatures) {
      const tx = await connection.getTransaction(sigInfo.signature, {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      });
      console.log("transaction: ", tx)
      const lengthOfAccsKeys = tx.transaction.message.getAccountKeys().staticAccountKeys.length
      const instructionIndex = tx.meta.innerInstructions[0].index
      console.log("instruction index: ", instructionIndex)
      let instructionDataHex = tx.transaction.message.compiledInstructions[instructionIndex].data.slice(0, 8).toString("hex")
      if (instructionDataHex === proposalCreateHex) {
        instructionDataHex = tx.transaction.message.compiledInstructions[instructionIndex + 1].data.slice(0, 8).toString("hex")
      }
      console.log("instruction data: ", instructionDataHex)
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
async function main() {
    const transfer_type = await getSignatures();
    console.log(transfer_type);

    // const response = await axios.get(dbUrl);
    // const data = response.data;
    // console.log("json data: ", data)
    // data.forEach((item) => {
    //     if (item.contract_name === transfer_type) {
    //         console.log("transaction type: ", transfer_type, item.type_id)
    //     }
    // });
}
main()
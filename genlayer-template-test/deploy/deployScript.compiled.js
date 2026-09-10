import { readFileSync } from "fs";
import path from "path";
import {
  TransactionStatus
} from "genlayer-js/types";
async function main(client) {
  const filePath = path.resolve(
    process.cwd(),
    "contracts/prolly_v2.py"
  );
  try {
    console.log("");
    console.log("======================================");
    console.log("DEPLOYING PROLLY V2");
    console.log("======================================");
    console.log("Contract file:", filePath);
    const contractCode = new Uint8Array(
      readFileSync(filePath)
    );
    await client.initializeConsensusSmartContract();
    const deployTransaction = await client.deployContract({
      code: contractCode,
      args: []
    });
    console.log("");
    console.log(
      "Deployment transaction:",
      deployTransaction
    );
    const receipt = await client.waitForTransactionReceipt({
      hash: deployTransaction,
      status: TransactionStatus.ACCEPTED,
      retries: 200
    });
    const executionResult = receipt.consensus_data?.leader_receipt?.[0]?.execution_result;
    if (executionResult !== "SUCCESS") {
      throw new Error(
        `Deployment failed. Receipt: ${JSON.stringify(
          receipt,
          null,
          2
        )}`
      );
    }
    const contractAddress = receipt.data?.contract_address;
    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "PROLLY V2 DEPLOYED SUCCESSFULLY"
    );
    console.log(
      "======================================"
    );
    console.log(
      "Transaction Hash:",
      deployTransaction
    );
    console.log(
      "Contract Address:",
      contractAddress
    );
    console.log("");
  } catch (error) {
    throw new Error(
      `Error during Prolly V2 deployment: ${String(
        error
      )}`
    );
  }
}
export {
  main as default
};

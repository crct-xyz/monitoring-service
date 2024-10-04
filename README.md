# Matching & Monitoring (M&M) Service

## Overview

The **Matching & Monitoring (M&M) Service** is responsible for monitoring transactions on the Solana blockchain and dispatching relevant information to downstream systems via Amazon Simple Queue Service (SQS). This service ensures that actions are accurately captured, processed, and communicated to the **Action Building Queue** for further handling.

## Table of Contents

1. [Features](#features)
2. [Architecture](#features).
3. [Installation](#installation)
4. [Usage](#usage)
5. [Message Standard](#message-standard)
6. [Deployment](#Deployment)

## Features

- **Blockchain Monitoring:** Connects to the Solana mainnet to monitor transaction signatures associated with a specific multisig account.
- **Action Classification:** Determines the type of transactions to monitor for dApps  (e.g., send, approve_tx, reject_tx, config) based on instruction data.
- **Trigger Event Monitoring:** Using a user defined trigger points to initiate alerts
- **Message Dispatching:** Sends structured messages to the Action Builder to initiate and produce the Action we will deliver as a Blink to the end user
- **Database Integration:** Retrieves action type configurations from an external database.
- **Scalable & Reliable:** Built using AWS Lambda and SQS to ensure scalability and reliability.

## Architecture

1. **Solana Connection:** Connects to the Solana mainnet.
2. **Transaction Monitoring:** Fetches and processes transaction signatures related to the multisig PDA.
3. **Action Classification:** Determines the type of action based on transaction instructions.
4. **Message Dispatching:** Sends a structured message to the Action Building Queue via AWS SQS.
5. **Database Integration:** Retrieves action type configurations from an external database for processing logic.

## Installation

1. **Clone the Repository:**

    ```bash
    git clone https://github.com/your-repo/matching-monitoring-service.git
    cd matching-monitoring-service
    ```

2. **Install Dependencies:**

    ```bash
    npm install
    ```


## Usage

The service is designed to be deployed as an AWS Lambda function, triggered periodically (e.g., via CloudWatch Events) to monitor and process new transactions.

### Running Locally

1. **Set Environment Variables:**

    Ensure all required environment variables are set, either via a `.env` file or your local environment.

2. **Invoke the Handler:**

    You can simulate invoking the AWS Lambda handler locally:

    ```bash
    node -e "require('./index').handler({})"
    ```

### Deploying to AWS Lambda

1. **Package the Code:**

    Ensure all dependencies are included.

    ```bash
    zip -r function.zip .
    ```

2. **Create/Update the Lambda Function:**

    Use the AWS CLI or AWS Console to create or update the Lambda function, uploading the `function.zip` file.

3. **Set Environment Variables:**

    Configure the Lambda function's environment variables as specified in the [Configuration](#configuration) section.

4. **Set Permissions:**

    Ensure the Lambda execution role has the necessary permissions, specifically `sqs:SendMessage` for the target queue and network permissions to access the Solana mainnet and the external database.

5. **Configure Triggers:**

    Set up CloudWatch Events or another scheduling mechanism to trigger the Lambda function at desired intervals.

## Message Standard

The M&M Service sends messages to the **Action Building Queue**. Adhering to the defined message standard ensures consistent and reliable processing by the Action Builder Service.

### Message Structure

Each message sent to the Action Building Queue follows the JSON structure below:

```json
{
  "TransactionType": "string",
}
```

#### Fields

| Field               | Type   | Description                                                                                                                                         | Required |
|---------------------|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| `TransactionType`   | String | A value that identifies the specific Transaction Type                                                                                               | Yes      |

### Payload Parameters

| Parameter            | Type   | Description                                                                                      | Required |
|----------------------|--------|--------------------------------------------------------------------------------------------------|----------|
| `transactionType`    | String | A value that identifies the specific Transaction Type                                             | Yes      |

### Validation Rules

- **Mandatory Fields:** Ensure that `transactionType` is present in every message.
- **Data Types:** All fields must be a string. Non-string types may result in processing errors.

## Deployment

Deploy the M&M Service as an AWS Lambda function for scalability and ease of management.

### Steps

1. **Prepare the Deployment Package:**

    Ensure all dependencies are included.

    ```bash
    zip -r function.zip .
    ```

2. **Create or Update Lambda Function:**

    Use the AWS CLI or AWS Console to create/update the function.

    ```bash
    aws lambda create-function --function-name MAndMService \
      --zip-file fileb://function.zip --handler index.handler --runtime nodejs14.x \
      --role arn:aws:iam::816069166828:role/lambda-execution-role
    ```

3. **Configure Environment Variables:**

    Set the necessary environment variables in the Lambda configuration.

4. **Set Up Triggers:**

    Configure CloudWatch Events to trigger the Lambda function at desired intervals (e.g., every minute).

5. **Assign Permissions:**

    Ensure the Lambda execution role has the necessary permissions (`sqs:SendMessage`, network access).

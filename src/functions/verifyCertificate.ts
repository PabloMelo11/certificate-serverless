import { APIGatewayProxyHandler } from 'aws-lambda';

import { document } from '../utils/dynamodbClient';

export const handle: APIGatewayProxyHandler = async (event) => {
  const { id } = event.pathParameters;

  const response = await document
    .query({
      TableName: 'users-certificates',
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': id,
      },
    })
    .promise();

  const userCertificate = response.Items[0];

  if (userCertificate) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Certificate valid!',
        name: userCertificate.name,
        url: `https://serverlesscertificate.s3.amazonaws.com/${id}.pdf`,
      }),
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Certificate invalid!',
      }),
    };
  }
};

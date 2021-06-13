import { APIGatewayProxyHandler } from 'aws-lambda';
import { join } from 'path';
import { S3 } from 'aws-sdk';
import { readFileSync } from 'fs';
import dayjs from 'dayjs';
import handlebars from 'handlebars';
import chromium from 'chrome-aws-lambda';
import { document } from '../utils/dynamodbClient';

type CreateCertificateDTO = {
  id: string;
  name: string;
  grade: number;
};

type TemplateDTO = {
  id: string;
  name: string;
  grade: number;
  date: string;
  medal: string;
};

const compile = async function (data: TemplateDTO) {
  const filePath = join(process.cwd(), 'src', 'templates', 'certificate.hbs');

  const html = readFileSync(filePath, 'utf-8');

  return handlebars.compile(html)(data);
};

export const handle: APIGatewayProxyHandler = async (event) => {
  const { id, name, grade } = JSON.parse(event.body) as CreateCertificateDTO;

  const response = await document
    .query({
      TableName: 'users-certificates',
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': id,
      },
    })
    .promise();

  const userAlreadExists = response.Items[0];

  if (!userAlreadExists) {
    await document
      .put({
        TableName: 'users_certificates',
        Item: {
          id,
          name,
          grade,
        },
      })
      .promise();
  }

  const medalPath = join(process.cwd(), 'src', 'templates', 'selo.png');
  const medal = readFileSync(medalPath, 'base64');

  const data: TemplateDTO = {
    date: dayjs().format('DD/MM/YYYY'),
    id,
    name,
    grade,
    medal,
  };

  const content = await compile(data);

  const browser = await chromium.puppeteer.launch({
    headless: true,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
  });

  const page = await browser.newPage();

  await page.setContent(content);

  const pdf = await page.pdf({
    format: 'a4',
    landscape: true,
    path: process.env.IS_OFFLINE ? 'certificate.pdf' : null,
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();

  const s3 = new S3();

  await s3
    .putObject({
      Bucket: 'serverless',
      Key: `${id}.pdf`,
      ACL: 'public-read',
      Body: pdf,
      ContentType: 'application/pdf',
    })
    .promise();

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: 'Certificate created!',
      url: `https://serverlesscertificate.s3.amazonaws.com/${id}.pdf`,
    }),
    headers: {
      ContentType: 'Application/json',
    },
  };
};

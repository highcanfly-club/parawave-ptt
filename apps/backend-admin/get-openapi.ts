/**
 * MIT License
 *
 * Copyright (c) 2025 Ronan LE MEILLAT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import fs from "fs";

import swaggerJsdoc from "swagger-jsdoc";

const options = {
  encoding: "utf8",
  failOnErrors: false, // Whether or not to throw when parsing errors. Defaults to false.
  format: "json",
  info: {
    title: "Parawave-PTT API",
    version: "1.0.0",
  },
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Parawave-PTT API",
      version: "1.1.0",
    },
  }, // You can move properties from definition here if needed
  apis: ["../cloudflare-worker/src/handlers/api-handler.ts"], // Path to the API docs
};

const openApi = await swaggerJsdoc(options);

openApi.components.securitySchemes = {
  bearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
};
openApi.security = [
  {
    bearerAuth: [],
  },
];

// Write the OpenAPI spec to a file public/openapi.json
fs.writeFileSync(
  "./public/openapi.json",
  JSON.stringify(openApi, null, 2),
  "utf8",
);

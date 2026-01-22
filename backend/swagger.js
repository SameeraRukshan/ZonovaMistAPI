const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Zonova Mist API",
    version: "1.0.0",
    description: "API documentation for the ZonovaMist Hotel Management System",
  },
  servers: [
  {
    url: "http://localhost:3000",
    description: "Local Development Server"
  },
  {
    url: "https://zonova-mist-api-dev-487454014534.us-central1.run.app", 
    description: "Cloud Dev Server"
  },
],
  components: { // For token
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  security: [
      {
        bearerAuth: [],
      },
    ],
};

// Options for swagger-jsdoc
const options = {
  swaggerDefinition,
  apis: ["./routes/*.js"], // Path to the API docs (adjust to your routes folder)
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

module.exports = { swaggerUi, swaggerSpec };

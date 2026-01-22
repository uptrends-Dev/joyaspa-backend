import swaggerJSDoc from "swagger-jsdoc";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "JOYA SPA API",
      version: "1.0.0",
      description: "JOYA SPA Backend API Documentation",
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Local server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },

 
  apis: [
    "./api/routes/*.js",
    "./api/controllers/*.js",
  ],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);

import swaggerJSDoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJSDoc ({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Fair Colors API',
      version: '1.0.0',
      description: `
API documentation.

## Global response format (standard)
All endpoints respond with this shape:

### Success
{
  "success": true,
  "message": "string",
  "data": any
}

### Error
{
  "success": false,
  "message": "string",
  "errors": [{ "field": "string", "message": "string" }]
}
      `.trim (),
    },
    servers: [{url: 'http://localhost:5550', description: 'Local server'}],

    // ✅ JWT Bearer auth (global)
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },

    // ✅ Apply JWT to everything by default
    security: [{bearerAuth: []}],

    tags: [{name: 'Auth', description: 'Authentication & OTP flows'}],
  },

  apis: ["./routes/**/*.js"],
});

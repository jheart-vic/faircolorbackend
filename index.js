import express from 'express';
import corsOptions from './config/cors.js';
import { connect } from 'mongoose';
import router from "./routes/index.js";
import swaggerUi from "swagger-ui-express";
import dotenv from 'dotenv';
import { swaggerSpec } from './swagger/swagger.js';
import helmet from 'helmet';


dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(corsOptions);
app.use(express.json());

// app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      persistAuthorization: true, // keeps JWT after refresh
    },
  })
);

app.use("/api", router);
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

app.get("/", (req, res) => {
  res.send(`
  <h1>Fair Colours API</h1>
  <p>Welcome to the Fair Colours API. Please refer to the <a href="/docs">API documentation</a> for details on available endpoints and how to use them.</p>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

connect(process.env.MONGO_URI, {
})
  .then(() => console.log(`✅ Connected to MongoDB`))
  .catch((err) => console.error('❌ MongoDB connection error:', err));



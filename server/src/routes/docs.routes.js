import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger.js';

const router = Router();

// Expose raw OpenAPI 3.0 JSON specification
router.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(swaggerSpec);
});

// Interactive Swagger UI documentation
router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'RicozData API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true
  }
}));

export default router;

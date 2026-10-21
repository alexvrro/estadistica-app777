const { Router } = require('express');
const ctrl = require('../controllers/historial.controller');

const router = Router();
router.get('/', ctrl.obtener);

module.exports = router;

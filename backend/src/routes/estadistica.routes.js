const { Router } = require('express');
const ctrl = require('../controllers/estadistica.controller');

const router = Router();

router.get('/ejemplo', ctrl.ejemplo);
router.post('/analizar', ctrl.analizarDatos);

module.exports = router;

const { Router } = require('express');
const ctrl = require('../controllers/estadistica.controller');

const router = Router();

router.get('/ejemplo', ctrl.ejemplo);
router.post('/analizar', ctrl.analizarDatos);
router.post('/interpretar', ctrl.interpretar);
router.post('/chat', ctrl.chat);

module.exports = router;

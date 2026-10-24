const { Router } = require('express');
const ctrl = require('../controllers/practica.controller');

const router = Router();

router.get('/progreso', ctrl.progreso);
router.post('/', ctrl.guardar);
router.delete('/', ctrl.reiniciar);

module.exports = router;

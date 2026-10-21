const { Router } = require('express');
const ctrl = require('../controllers/registro.controller');

const router = Router();

router.get('/', ctrl.listar);
router.post('/', ctrl.guardar);
router.get('/:id', ctrl.obtener);
router.delete('/:id', ctrl.eliminar);

module.exports = router;

const router = require('express').Router();
const Transaction = require('../models/transaction.js');

router.post('/api/transaction', async ({ body }, res) => {
  try {
    res.json(await Transaction.create(body));
  } catch (err) {
    res.status(400).json(err);
  }
});

// Used to sync transactions that were created while offline
router.post('/api/transaction/bulk', async ({ body }, res) => {
  try {
    res.json(await Transaction.insertMany(body));
  } catch (err) {
    res.status(400).json(err);
  }
});

router.get('/api/transaction', async (req, res) => {
  try {
    res.json(await Transaction.find({}).sort({ date: -1 }));
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;

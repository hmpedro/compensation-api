const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize');
const { sequelize } = require('./model');
const { getProfile } = require('./middleware/getProfile');

const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);

/**
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models');
  const userProfile = req.profile;
  const { id } = req.params;
  const contract = await Contract.findOne({
    where: {
      id,
      [Op.or]: [
        { ContractorId: userProfile.id },
        { ClientId: userProfile.id },
      ],
    },
  });
  if (!contract) return res.status(404).end();
  res.json(contract);
});

/**
 * @returns all contracts for the user
 */
app.get('/contracts', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models');
  const userProfile = req.profile;
  const contract = await Contract.findAll({
    where: {
      status: { [Op.ne]: 'terminated' },
      [Op.or]: [
        { ContractorId: userProfile.id },
        { ClientId: userProfile.id },
      ],
    },
  });
  if (!contract) return res.status(404).end();
  res.json(contract);
});
module.exports = app;

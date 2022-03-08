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
 * @returns A contract by id
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
 * @returns List of all contracts for the user
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

/**
 * @returns List of unpaid jobs from active contracts for the user
 */
app.get('/jobs/unpaid', getProfile, async (req, res) => {
  const { Contract, Job } = req.app.get('models');
  const userProfile = req.profile;
  const contract = await Job.findAll({
    where: {
      [Op.or]: [
        { paid: 'terminated' },
        { paid: null },
      ],
    },
    include: [
      {
        model: Contract,
        required: true,
        where: {
          [Op.or]: [
            { ContractorId: userProfile.id },
            { ClientId: userProfile.id },
          ],
          status: 'in_progress',
        },
      },
    ],
  });
  if (!contract) return res.status(404).end();
  res.json(contract);
});

module.exports = app;

const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize');
const { constants: httpConstants } = require('http2');
const { getProfile } = require('./middleware/getProfile');
const { sequelize } = require('./model');

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

/**
 * @returns Pay for a job
 */
app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
  const { Contract, Job, Profile } = req.app.get('models');
  // const { sequelize } = req.app.get('sequelize');
  const userProfile = req.profile;
  const { job_id: jobId } = req.params;

  if (userProfile.type !== 'client') {
    return res.status(400).send('Invalid user type').end();
  }

  const contract = await Contract.findOne({
    where: {
      ClientId: userProfile.id,
    },
    include: [
      {
        model: Job,
        where: {
          id: jobId,
        },
      },
    ],
  });

  if (!contract) {
    return res.status(400).send('Invalid client for job').end();
  }

  const job = await Job.findOne({
    where: {
      id: jobId,
    },
  });

  if (job.paid) {
    return res.status(400).send('Job already paid').end();
  }

  if (job.price > userProfile.balance) {
    return res.status(400).send('Insufficient balance').end();
  }

  try {
    await sequelize.transaction(async (transaction) => {
      await Profile.update(
        { balance: userProfile.balance - job.price },
        { where: { id: userProfile.id } },
        { transaction },
      );

      const contractorProfile = await Profile.findOne({
        include: [
          {
            model: Contract,
            as: 'Contractor',
            required: true,
            include: [
              {
                model: Job,
                required: true,
                where: {
                  id: job.id,
                },
              },
            ],
          },
        ],
      }, { transaction });

      await Profile.update(
        { balance: contractorProfile.balance + job.price },
        { where: { id: contractorProfile.id } },
        { transaction },
      );

      await Job.update(
        {
          paid: true,
          paymentDate: new Date(),
        },
        { where: { id: jobId } },
      );
    });
    // Committed
  } catch (err) {
    // Rolled back
    console.error(err);
    return res.status(500).send('Something went wrong, try again later').end();
  }

  res.status(httpConstants.HTTP_STATUS_NO_CONTENT).end();
});

/**
 * @returns  Deposits money into the balance of a client
 */
app.post('/balances/deposit/:userId', getProfile, async (req, res) => {
  const { Contract, Job, Profile } = req.app.get('models');
  // const { sequelize } = req.app.get('sequelize');
  const userProfile = req.profile;
  const { job_id: jobId } = req.params;

  if (userProfile.type !== 'client') {
    return res.status(400).send('Invalid user type').end();
  }

  const contract = await Contract.findOne({
    where: {
      ClientId: userProfile.id,
    },
    include: [
      {
        model: Job,
        where: {
          id: jobId,
        },
      },
    ],
  });

  if (!contract) {
    return res.status(400).send('Invalid client for job').end();
  }

  const job = await Job.findOne({
    where: {
      id: jobId,
    },
  });

  if (job.paid) {
    return res.status(400).send('Job already paid').end();
  }

  if (job.price > userProfile.balance) {
    return res.status(400).send('Insufficient balance').end();
  }

  try {
    await sequelize.transaction(async (transaction) => {
      await Profile.update(
        { balance: userProfile.balance - job.price },
        { where: { id: userProfile.id } },
        { transaction },
      );

      const contractorProfile = await Profile.findOne({
        include: [
          {
            model: Contract,
            as: 'Contractor',
            required: true,
            include: [
              {
                model: Job,
                required: true,
                where: {
                  id: job.id,
                },
              },
            ],
          },
        ],
      }, { transaction });

      await Profile.update(
        { balance: contractorProfile.balance + job.price },
        { where: { id: contractorProfile.id } },
        { transaction },
      );

      await Job.update(
        {
          paid: true,
          paymentDate: new Date(),
        },
        { where: { id: jobId } },
      );
    });
    // Committed
  } catch (err) {
    // Rolled back
    console.error(err);
    return res.status(500).send('Something went wrong, try again later').end();
  }

  res.status(httpConstants.HTTP_STATUS_NO_CONTENT).end();
});

/**
 * @returns Most profitable profession for period
 */
app.get('/admin/best-profession', getProfile, async (req, res) => {
  const { Contract, Job, Profile } = req.app.get('models');
  const { start, end } = req.query;
  /*
  let rangeQuery = '';
  if (start && end) {
    const startSql = new Date(start).toISOString();
    const endSql = new Date(end).toISOString();
    rangeQuery = `AND j.paymentDate >= "${startSql}" AND j.paymentDate <= "${endSql}"`;
  }

  const [mostProfitableProfession] = await sequelize.query(`
      SELECT p.profession, SUM(j.price) AS profit
      FROM Profiles p
       INNER JOIN Contracts C on p.id = C.ContractorId
       INNER join Jobs j on C.id = j.ContractId
      WHERE j.paid = true
      ${rangeQuery}
      GROUP BY p.profession
      ORDER BY profit DESC
      LIMIT 1`);
*/

  const mostProfitableProfession = await Job.findOne({
    attributes: [
      [sequelize.fn('sum', sequelize.col('price')), 'profit'],
    ],
    where: {
      paid: true,
      ...(start && end && {
        paymentDate: {
          [Op.gte]: start,
          [Op.lte]: end,
        },
      }),
    },
    group: 'Contract.Contractor.profession',
    order: [
      [sequelize.col('profit'), 'DESC'],
    ],
    include: [
      {
        model: Contract,
        required: true,
        include: [
          {
            model: Profile,
            as: 'Contractor',
            attributes: [
              'profession',
            ],
            required: true,
          },
        ],
      },
    ],
  });

  if (!mostProfitableProfession) return res.status(404).end();
  res.json({
    profession: mostProfitableProfession.Contract.Contractor.profession,
    profit: mostProfitableProfession.get('profit'),
  });
});

/**
 * @returns List of clients with the greatest payments for period
 */
app.get('/admin/best-clients', getProfile, async (req, res) => {
  const { Contract, Job, Profile } = req.app.get('models');
  const { start, end, limit = 2 } = req.query;
  /*
  let rangeQuery = '';
  if (start && end) {
    const startSql = new Date(start).toISOString();
    const endSql = new Date(end).toISOString();
    rangeQuery = `AND j.paymentDate >= "${startSql}" AND j.paymentDate <= "${endSql}"`;
  }

  const [mostPayableClient] = await sequelize.query(`
      SELECT p.id, p.firstName || ' ' || p.lastName AS fullName, SUM(j.price) AS totalPayments
      FROM Profiles p
       INNER JOIN Contracts C on p.id = C.ClientId
       inner join Jobs j on C.id = j.ContractId
      WHERE j.paid = true
      ${rangeQuery}
      GROUP BY p.id
      ORDER BY totalPayments DESC
      LIMIT :limit`, {
    replacements: { limit },
  });
  */

  const mostPayableClients = await Job.findAll({
    attributes: [
      [sequelize.fn('sum', sequelize.col('price')), 'totalPayments'],
    ],
    where: {
      paid: true,
      ...(start && end && {
        paymentDate: {
          [Op.gte]: start,
          [Op.lte]: end,
        },
      }),
    },
    group: 'Contract.Client.id',
    order: [
      [sequelize.col('totalPayments'), 'DESC'],
    ],
    limit,
    include: [
      {
        model: Contract,
        required: true,
        include: [
          {
            model: Profile,
            as: 'Client',
            required: true,
          },
        ],
      },
    ],
  });

  if (!mostPayableClients) return res.status(404).end();
  res.json(mostPayableClients.map((obj) => ({
    id: obj.Contract.Client.id,
    fullName: [obj.Contract.Client.firstName, obj.Contract.Client.lastName].join(' '),
    totalPayments: obj.get('totalPayments'),
  })));
});

module.exports = app;

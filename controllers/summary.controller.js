const Child = require('../model/child.model');
const Record = require('../model/record.model');
const Parent = require('../model/parent.model');

const getSummaries = async (req, res) => {
  try {
    const childLength = await Child.find().countDocuments().exec();
    const parentLength = await Parent.find().countDocuments().exec();

    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    const pemeriksaan = await Record.find({
      tanggalPencatatan: {
        $gte: new Date(thisYear, thisMonth, 1),
        $lt: new Date(thisYear, thisMonth + 1, 1),
      },
    });
    const pemeriksaanBulanIniLength = pemeriksaan.length;
    const pemeriksaanBurukLength = pemeriksaan.filter(
      (item) => item.status['bb/tb'] === 'Gizi buruk' || item.status['bb/tb'] === 'Gizi kurang'
    ).length;
    const pemeriksaan2TLength = pemeriksaan.filter(
      (item) => item.statusPerkembangan === '2T'
    ).length;

    const summary = {
      countChild: childLength,
      countParent: parentLength,
      countRecordThisMonth: pemeriksaanBulanIniLength,
      countMalnourishedChild: pemeriksaanBurukLength,
      countNotGrowingChild: pemeriksaan2TLength,
    };

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
};

const indicationStatusCode = {
  WOH_0: 'Gizi buruk',
  WOH_1: 'Gizi kurang',
  WOH_2: 'Gizi normal',
  WOH_3: 'Berisiko gizi lebih',
  WOH_4: 'Gizi lebih (overweight)',
  WOH_5: 'Obesitas',
};

const getChildrenByRecordStatus = async (req, res) => {
  try {
    const { statusPerkembangan, status } = req.query;
    let query = {};

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    query.tanggalPencatatan = {
      $gte: startOfMonth,
      $lt: startOfNextMonth,
    };

    if (statusPerkembangan) {
      const statusValues = statusPerkembangan.split(',').map((status) => status.trim());
      query['statusPerkembangan'] = { $in: statusValues };
    }

    if (status) {
      const statusValues = status.split(',').map((status) => status.trim());
      query['status.bb/tb'] = { $in: statusValues.map((status) => indicationStatusCode[status]) };
    }

    const records = await Record.find(query).populate({
      path: 'idAnak',
      select: 'nama _id',
      model: Child,
    });

    res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error('Error filtering records:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while filtering records',
      error: error.message,
    });
  }
};

const summaryController = {
  getSummaries,
  getChildrenByRecordStatus,
};

module.exports = summaryController;

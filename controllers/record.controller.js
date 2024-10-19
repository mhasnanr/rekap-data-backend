const data = require('../data');
const reportEntity = require('../entities/report');
const Record = require('../model/record.model');

const weightOverAgeEnum = {
  WOA_0: 'Berat badan sangat kurang',
  WOA_1: 'Berat badan kurang',
  WOA_2: 'Berat badan normal',
  WOA_3: 'Risiko berat badan lebih',
};

const heightOverAgeStatus = {
  HOA_0: 'Sangat pendek',
  HOA_1: 'Pendek',
  HOA_2: 'Normal',
  HOA_3: 'Tinggi',
};

const weightOverHeightStatus = {
  WOH_0: 'Gizi buruk',
  WOH_1: 'Gizi kurang',
  WOH_2: 'Gizi normal',
  WOH_3: 'Berisiko gizi lebih',
  WOH_4: 'Gizi lebih (overweight)',
  WOH_5: 'Obesitas',
};

const inferWeightOverAgeStatus = (age, weight, gender) => {
  let bbPerUmur;

  if (gender === 'L') {
    const median = data.lakiLaki.bbPerUmur.median[age];
    bbPerUmur =
      weight < median
        ? (weight - median) / (median - data.lakiLaki.bbPerUmur['-1_SD'][age])
        : (weight - median) / (data.lakiLaki.bbPerUmur['+1_SD'][age] - median);
  } else {
    const median = data.perempuan.bbPerUmur.median[age];
    bbPerUmur =
      weight < median
        ? (weight - median) / (median - data.perempuan.bbPerUmur['-1_SD'][age])
        : (weight - median) / (data.perempuan.bbPerUmur['+1_SD'][age] - median);
  }

  if (bbPerUmur < -3) {
    return weightOverAgeEnum.WOA_0;
  } else if (bbPerUmur <= -2) {
    return weightOverAgeEnum.WOA_1;
  } else if (bbPerUmur <= 1) {
    return weightOverAgeEnum.WOA_2;
  } else {
    return weightOverAgeEnum.WOA_3;
  }
};

const inferHeightOverAgeStatus = (age, height, gender) => {
  let tbPerUmur;
  if (gender === 'L') {
    const median = data.lakiLaki.tbPerUmur.median[age];
    tbPerUmur =
      height < median
        ? (height - median) / (median - data.lakiLaki.tbPerUmur['-1_SD'][age])
        : (height - median) / (data.lakiLaki.tbPerUmur['+1_SD'][age] - median);
  } else {
    const median = data.perempuan.tbPerUmur.median[age];
    tbPerUmur =
      height < median
        ? (height - median) / (median - data.perempuan.tbPerUmur['-1_SD'][age])
        : (height - median) / (data.perempuan.tbPerUmur['+1_SD'][age] - median);
  }

  if (tbPerUmur <= -3) {
    return heightOverAgeStatus.HOA_0;
  } else if (tbPerUmur <= -2) {
    return heightOverAgeStatus.HOA_1;
  } else if (tbPerUmur <= 1) {
    return heightOverAgeStatus.HOA_2;
  } else {
    return heightOverAgeStatus.HOA_3;
  }
};

const inferWeightOverHeightStatus = (age, weight, height, gender) => {
  const lowerBound = 45.0;
  const difference = height - lowerBound;
  const remainder = difference % 0.5;

  const target =
    remainder < 0.25 ? lowerBound + Math.floor(difference) : lowerBound + Math.ceil(difference);

  const ageRange = age <= 24 ? '0-24' : '24-60';

  if (gender === 'L') {
    const index = data.lakiLaki.bbPerTb[ageRange].tinggiBadan.findIndex(
      (value) => value === target
    );

    const median = data.lakiLaki.bbPerTb[ageRange].median[index];
    bbPerTb =
      weight < median
        ? (weight - median) / (median - data.lakiLaki.bbPerTb[ageRange]['-1_SD'][index])
        : (weight - median) / (data.lakiLaki.bbPerTb[ageRange]['+1_SD'][index] - median);
  } else {
    const index = data.perempuan.bbPerTb[ageRange].tinggiBadan.findIndex(
      (value) => value === target
    );
    const median = data.perempuan.bbPerTb[ageRange].median[index];
    bbPerTb =
      weight < median
        ? (weight - median) / (median - data.perempuan.bbPerTb[ageRange]['-1_SD'][index])
        : (weight - median) / (data.perempuan.bbPerTb[ageRange]['+1_SD'][index] - median);
  }

  if (bbPerTb <= -3) {
    return weightOverHeightStatus.WOH_0;
  } else if (bbPerTb <= -2) {
    return weightOverHeightStatus.WOH_1;
  } else if (bbPerTb <= 1) {
    return weightOverHeightStatus.WOH_2;
  } else if (bbPerTb <= 2) {
    return weightOverHeightStatus.WOH_3;
  } else if (bbPerTb <= 3) {
    return weightOverHeightStatus.WOH_4;
  } else {
    return weightOverHeightStatus.WOH_5;
  }
};

const inferNutritionStatus = (usia, beratBadan, tinggiBadan, jenisKelamin) => {
  const weightOverAgeStatus = inferWeightOverAgeStatus(usia, beratBadan, jenisKelamin);
  const heightOverAgeStatus = inferHeightOverAgeStatus(usia, tinggiBadan, jenisKelamin);
  const weightOverHeightStatus = inferWeightOverHeightStatus(
    usia,
    beratBadan,
    tinggiBadan,
    jenisKelamin
  );

  const status = {
    'bb/u': weightOverAgeStatus,
    'tb/u': heightOverAgeStatus,
    'bb/tb': weightOverHeightStatus,
  };

  return status;
};

const isBelowTheThreshold = (usia, selisih) => {
  return (
    (usia <= 5 && selisih < reportEntity.rangeToBoundaries[usia]) ||
    (usia >= 6 && usia <= 7 && selisih < reportEntity.rangeToBoundaries['6-7']) ||
    (usia >= 8 && usia <= 11 && selisih < reportEntity.rangeToBoundaries['8-11']) ||
    (usia >= 12 && usia <= 23 && selisih < reportEntity.rangeToBoundaries['12-60']) ||
    (usia >= 24 && usia <= 35 && selisih < reportEntity.rangeToBoundaries['12-60']) ||
    (usia >= 36 && usia <= 59 && selisih < reportEntity.rangeToBoundaries['12-60'])
  );
};

const inferDataStatus = async (idAnak, usia, pertamaKali, beratBadan, tanggalPemeriksaan) => {
  const recordDate = new Date(tanggalPemeriksaan);
  const record = await Record.find({
    idAnak: idAnak,
  });

  const arrayOfWeight = [beratBadan, null, null];

  record.forEach((record) => {
    const tanggalPencatatan = new Date(record.tanggalPencatatan);
    const month = tanggalPencatatan.getMonth();
    const bulanPemeriksaan = recordDate.getMonth();
    const selisih = bulanPemeriksaan - month;
    if (
      tanggalPencatatan.getFullYear() === recordDate.getFullYear() &&
      tanggalPencatatan < recordDate &&
      (selisih > 0) & (selisih <= 2)
    ) {
      arrayOfWeight[selisih] = record.beratBadan;
    }
  });

  const [now, prevOne, prevTwo] = arrayOfWeight;

  if (pertamaKali) return 'B';
  else {
    if (now !== null && prevOne !== null && prevTwo !== null) {
      const diffOne = parseFloat(now - prevOne).toFixed(2) * 1000;
      const diffTwo = parseFloat(prevOne - prevTwo).toFixed(2) * 1000;
      if (isBelowTheThreshold(usia, diffOne) && isBelowTheThreshold(usia - 1, diffTwo)) {
        return '2T';
      } else if (diffOne > 0) {
        if (isBelowTheThreshold(usia, diffOne)) return 'T';
        else return 'N';
      } else if (diffOne <= 0) {
        return 'T';
      }
    } else if (now !== null && prevOne !== null) {
      const difference = parseFloat((now - prevOne).toFixed(2)) * 1000;
      if (isBelowTheThreshold(usia, difference)) return 'T';
      else return 'N';
    } else if (now !== null) {
      return 'O,T';
    } else if (prevOne !== null) {
      return 'T';
    } else if (prevTwo !== null) {
      return 'T';
    } else {
      return '2T';
    }
  }
};

const createRecord = async (req, res) => {
  const { usia, beratBadan, jenisKelamin, tinggiBadan, idAnak, pertamaKali, tanggalPencatatan } =
    req.body;

  const status = inferNutritionStatus(usia, beratBadan, tinggiBadan, jenisKelamin);
  const statusPerkembangan = await inferDataStatus(
    idAnak,
    usia,
    pertamaKali,
    beratBadan,
    tanggalPencatatan
  );

  try {
    const record = await Record.create({
      ...req.body,
      status,
      statusPerkembangan,
    });
    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateRecord = async (req, res) => {
  const recordId = req.params.id;
  const { idAnak, usia, pertamaKali, beratBadan, tanggalPencatatan } = req.body;

  try {
    const record = await Record.findById(recordId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }

    const updatedRecord = await Record.findByIdAndUpdate(
      recordId,
      { ...req.body },
      { new: true, runValidators: true }
    );

    const newStatus = inferNutritionStatus(
      req.body?.usia ? req.body.usia : updatedRecord.usia,
      req.body?.beratBadan ? req.body.beratBadan : updatedRecord.beratBadan,
      req.body?.tinggiBadan ? req.body.tinggiBadan : updatedRecord.tinggiBadan,
      req.body?.jenisKelamin ? req.body.jenisKelamin : updatedRecord.jenisKelamin
    );

    const newStatusPerkembangan = await inferDataStatus(
      idAnak,
      req.body?.usia ? req.body.usia : updatedRecord.usia,
      req.body?.pertamaKali ? req.body.pertamaKali : updatedRecord.pertamaKali,
      req.body?.beratBadan ? req.body.beratBadan : updatedRecord.beratBadan,
      req.body?.tanggalPencatatan ? req.body.tanggalPencatatan : updatedRecord.tanggalPencatatan
    );

    updatedRecord.status = newStatus;
    updatedRecord.statusPerkembangan = newStatusPerkembangan;

    await updatedRecord.save();

    res.status(200).json({
      success: true,
      data: updatedRecord,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRecords = async (req, res) => {
  const { month, year } = req.query;

  if (month && year) {
    try {
      const records = await Record.find({
        tanggalPencatatan: {
          $gte: new Date(year, month - 1, 1),
          $lt: new Date(year, month, 1),
        },
      })
        .sort({ tanggalPencatatan: -1 })
        .populate('idAnak');

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  } else if (month && !year) {
    const thisYear = new Date().getFullYear();
    try {
      const records = await Record.find(
        {
          tanggalPencatatan: {
            $gte: new Date(thisYear, month - 1, 1),
            $lt: new Date(thisYear, month, 1),
          },
        }
          .sort({ tanggalPencatatan: -1 })
          .populate('idAnak')
      );

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  } else if (!month && year) {
    try {
      const records = await Record.find(
        {
          tanggalPencatatan: {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year, 12, 1),
          },
        }
          .sort({ tanggalPencatatan: -1 })
          .populate('idAnak')
      );

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  } else
    try {
      const records = await Record.find().sort({ tanggalPencatatan: -1 }).populate('idAnak');
      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
};

const getRecordsByChildId = async (req, res) => {
  const idAnak = req.params.id;

  try {
    const record = await Record.find({ idAnak }).sort({ tanggalPencatatan: -1 });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Pencatatan tidak ditemukan',
      });
    }

    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getGroupedRecordDateList = async (_, res) => {
  try {
    const records = await Record.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$tanggalPencatatan' },
            month: { $month: '$tanggalPencatatan' },
          },
        },
      },
      {
        $sort: {
          '_id.year': -1,
          '_id.month': -1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: records?.length > 0 ? records.map((record) => record._id) : [],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRecord = async (req, res) => {
  const recordId = req.params.id;

  try {
    const record = await Record.findById(recordId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }

    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteRecord = async (req, res) => {
  const recordId = req.params.id;

  try {
    const record = await Record.findById(recordId);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }

    await Record.deleteOne({ _id: recordId });

    res.status(200).json({
      success: true,
      message: 'Data pemeriksaan berhasil dihapus',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const recordController = {
  getRecord,
  getRecords,
  getGroupedRecordDateList,
  getRecordsByChildId,
  createRecord,
  updateRecord,
  deleteRecord,
};

module.exports = recordController;

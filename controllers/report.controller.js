const Record = require('../model/record.model');
const path = require('path');
const ExcelJS = require('exceljs');
const reportEntity = require('../entities/report');
const fs = require('fs');
const {
  getChildSummary,
  getRecordedChild,
  getImmunisationSummary,
} = require('../entities/child.js');

const getDataHeaders = (worksheet) => {
  const headers = {};
  let monthCount = 0;
  worksheet.getRow(9).eachCell((cell, colNumber) => {
    let value = cell.value.toLowerCase();
    if (cell.value === 'BB' || cell.value === 'TB' || cell.value === 'LL' || cell.value === 'LK') {
      value = `${value}_${reportEntity.monthWithPrev[monthCount]}`;
      if ((colNumber + 1) % 4 == 0) {
        monthCount++;
      }
    }
    if (value === 'bulan') {
      value = 'usia';
    }
    if (value === 'tanggal lahir') {
      value = 'tanggalLahir';
    }
    if (value === 'nama ortu') {
      value = 'namaOrtu';
    }
    headers[value] = colNumber;
  });
  return headers;
};

const commitChildRecords = (data, worksheet, headers) => {
  data.forEach((row, rowIndex) => {
    const excelRow = worksheet.getRow(rowIndex + 10);
    for (const [key, value] of Object.entries(row)) {
      if (headers[key] !== undefined) {
        excelRow.getCell(headers[key]).value = value;
      }
      excelRow.getCell(headers['no']).value = rowIndex + 1;
    }
    excelRow.commit();
  });
};

const commitJumlahBalita = (dataDusun, worksheet, row) => {
  const data = Object.values(dataDusun).flatMap((item) => [item.l, item.p]);
  data.map((item, index) => {
    worksheet.getCell(row, index + 2).value = item;
  });
};

const commitJumlahBalitaDitimbang = (dataDusun, worksheet, row) => {
  const data = Object.values(dataDusun).flatMap((item) => [item.l, item.p]);
  data.map((item, index) => {
    worksheet.getCell(row, index + 15).value = item;
  });
};

const commitStatistikImunisasi = (dataImunisasi, worksheet, row) => {
  const data = Object.values(dataImunisasi).flatMap((item) => [item.l, item.p, item.total]);
  data.map((item, index) => {
    worksheet.getCell(row, index + 1).value = item;
  });
};

const commitJumlahBalitaNaik = (data, month) => {
  const thresholdCheck = (usia, selisih) => {
    let rangeUsia = null;
    let summaryRange = null;

    if (usia <= 5) {
      rangeUsia = usia;
      summaryRange = '0-5';
    } else if (usia >= 6 && usia <= 7) {
      rangeUsia = '6-7';
      summaryRange = '6-11';
    } else if (usia >= 8 && usia <= 11) {
      rangeUsia = '8-11';
      summaryRange = '6-11';
    } else if (usia >= 12 && usia <= 23) {
      rangeUsia = '12-60';
      summaryRange = '12-23';
    } else if (usia >= 24 && usia <= 35) {
      rangeUsia = '12-60';
      summaryRange = '24-35';
    } else if (usia >= 36) {
      rangeUsia = '12-60';
      summaryRange = '36-59';
    }

    return [summaryRange, selisih < reportEntity.rangeToBoundaries[rangeUsia]];
  };

  const summary = {
    '0-5': { l: 0, p: 0 },
    '6-11': { l: 0, p: 0 },
    '12-23': { l: 0, p: 0 },
    '24-35': { l: 0, p: 0 },
    '36-59': { l: 0, p: 0 },
    total: { l: 0, p: 0 },
    O: { l: 0, p: 0 },
    B: { l: 0, p: 0 },
    T: { l: 0, p: 0 },
    '2T': { l: 0, p: 0 },
  };

  data.map((row) => {
    const now = row[`bb_${reportEntity.month[month]}`] || null;
    const prevOne = row[`bb_${reportEntity.month[month - 1]}`] || null;
    const prevTwo = row[`bb_${reportEntity.month[month - 2]}`] || null;

    const usia = row.usia;
    const jenisKelamin = row.l === 'x' ? 'l' : 'p';

    if (row.pertamaKali) {
      summary['B'][jenisKelamin]++;
    } else {
      if (now !== null && prevOne !== null && prevTwo !== null) {
        const diffOne = parseFloat(now - prevOne).toFixed(2) * 1000;
        const diffTwo = parseFloat(prevOne - prevTwo).toFixed(2) * 1000;
        if (thresholdCheck(usia, diffOne)[1] && thresholdCheck(usia - 1, diffTwo)[1]) {
          summary['2T'][jenisKelamin]++;
        } else if (diffOne > 0) {
          if (thresholdCheck(usia, diffOne)[1]) {
            summary['T'][jenisKelamin]++;
          } else {
            summary[thresholdCheck(usia, diffTwo)[0]][jenisKelamin]++;
            summary['total'][jenisKelamin]++;
          }
        } else if (diffOne <= 0) {
          summary['T'][jenisKelamin]++;
        }
      } else if (now !== null && prevOne !== null) {
        const difference = parseFloat(now - prevOne).toFixed(2) * 1000;
        if (difference > 0) {
          if (thresholdCheck(usia, difference)[1]) {
            summary['T'][jenisKelamin]++;
          } else {
            const diffTwo = parseFloat(prevOne - prevTwo).toFixed(2) * 1000;
            summary[thresholdCheck(usia, diffTwo)[0]][jenisKelamin]++;
            summary['total'][jenisKelamin]++;
          }
        } else {
          summary['T'][jenisKelamin]++;
        }
      } else if (now !== null) {
        summary['T'][jenisKelamin]++;
        summary['O'][jenisKelamin]++;
      } else if (prevOne !== null) {
        summary['T'][jenisKelamin]++;
      } else if (prevTwo !== null) {
        summary['T'][jenisKelamin]++;
      } else {
        summary['2T'][jenisKelamin]++;
      }
    }
  });

  count = Object.values(summary).flatMap((item) => [item.l, item.p]);
  return count;
};

const separateDataByGender = (data) => {
  return [data.filter((row) => row.l === 'x'), data.filter((row) => row.p === 'x')];
};

const generateReport = async (year, month, data, dataDusun, dataImunisasi) => {
  const pegundunganData = data.filter((row) => row.alamat === 'Pegundungan');
  const simparData = data.filter((row) => row.alamat === 'Simpar');
  const srandilData = data.filter((row) => row.alamat === 'Srandil');

  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(__dirname, 'template.xlsx');

  await workbook.xlsx.readFile(templatePath);
  const worksheetOne = workbook.getWorksheet('Mentari I (L)');
  const worksheetOneGirl = workbook.getWorksheet('Mentari I (P)');
  const worksheetTwo = workbook.getWorksheet('Mentari II (L)');
  const worksheetTwoGirl = workbook.getWorksheet('Mentari II (P)');
  const worksheetThree = workbook.getWorksheet('Mentari III (L)');
  const worksheetThreeGirl = workbook.getWorksheet('Mentari III (P)');
  const worksheetFour = workbook.getWorksheet('Laporan Bulanan');

  const headersSheetOne = getDataHeaders(worksheetOne);
  const headersSheetTwo = getDataHeaders(worksheetTwo);
  const headersSheetThree = getDataHeaders(worksheetThree);

  const [cowoPegundungan, cewePegundungan] = separateDataByGender(pegundunganData);
  const [cowoSimpar, ceweSimpar] = separateDataByGender(simparData);
  const [cowoSrandil, ceweSrandil] = separateDataByGender(srandilData);

  commitChildRecords(cowoPegundungan, worksheetOne, headersSheetOne);
  commitChildRecords(cewePegundungan, worksheetOneGirl, headersSheetOne);
  commitChildRecords(cowoSimpar, worksheetTwo, headersSheetTwo);
  commitChildRecords(ceweSimpar, worksheetTwoGirl, headersSheetTwo);
  commitChildRecords(cowoSrandil, worksheetThree, headersSheetThree);
  commitChildRecords(ceweSrandil, worksheetThreeGirl, headersSheetThree);

  commitJumlahBalita(dataDusun['pegundungan'], worksheetFour, 29);
  commitJumlahBalita(dataDusun['simpar'], worksheetFour, 30);
  commitJumlahBalita(dataDusun['srandil'], worksheetFour, 31);

  commitJumlahBalitaDitimbang(getRecordedChild(pegundunganData, year, month), worksheetFour, 29);
  commitJumlahBalitaDitimbang(getRecordedChild(simparData, year, month), worksheetFour, 30);
  commitJumlahBalitaDitimbang(getRecordedChild(srandilData, year, month), worksheetFour, 31);

  commitStatistikImunisasi(dataImunisasi, worksheetFour, 43);

  const headersSheetFour = {};
  worksheetFour.getRow(4).eachCell((cell, colNumber) => {
    let value = cell.value.toLowerCase();
    value = `${value}_${colNumber}`;
    headersSheetFour[value] = colNumber;
  });

  const count = commitJumlahBalitaNaik(data, month - 1);
  count.forEach((item, index) => {
    const jenisKelamin = index % 2 === 0 ? 'l' : 'p';
    worksheetFour.getCell(5, headersSheetFour[`${jenisKelamin}_${index + 1}`]).value = item;
  });

  const outputPath = '/tmp';

  try {
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    const filePath = path.join(
      outputPath,
      `TB BB ${reportEntity.monthCapital[month - 1]} Pegundungan ${year}.xlsx`
    );
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  } catch (error) {
    console.error(error);
    return null;
  }
};

async function generateSummary(year, bulan) {
  const startDate = new Date(year - 1, 11, 1);
  const endDate = new Date(year + 1, 0, 1);

  const pipeline = [
    {
      $match: {
        tanggalPencatatan: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $lookup: {
        from: 'children',
        let: { idAnak: { $toObjectId: '$idAnak' } },
        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$idAnak'] } } }],
        as: 'infoAnak',
      },
    },
    {
      $unwind: '$infoAnak',
    },
    {
      $lookup: {
        from: 'parents',
        let: { idOrangTua: { $toObjectId: '$infoAnak.idOrangTua' } },
        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$idOrangTua'] } } }],
        as: 'infoOrtu',
      },
    },
    {
      $unwind: '$infoOrtu',
    },
    {
      $group: {
        _id: {
          idAnak: '$idAnak',
          month: { $month: '$tanggalPencatatan' },
          year: { $year: '$tanggalPencatatan' },
        },
        infoAnak: { $first: '$infoAnak' },
        infoOrtu: { $first: '$infoOrtu' },
        beratBadan: { $first: '$beratBadan' },
        tinggiBadan: { $first: '$tinggiBadan' },
        pertamaKali: { $first: '$pertamaKali' },
        lingkarKepala: { $first: '$lingkarKepala' },
        lingkarLengan: { $first: '$lingkarLengan' },
      },
    },
    {
      $group: {
        _id: '$_id.idAnak',
        infoAnak: { $first: '$infoAnak' },
        infoOrtu: { $first: '$infoOrtu' },
        monthlyData: {
          $push: {
            month: '$_id.month',
            year: '$_id.year',
            beratBadan: '$beratBadan',
            tinggiBadan: '$tinggiBadan',
            pertamaKali: '$pertamaKali',
            lingkarKepala: '$lingkarKepala',
            lingkarLengan: '$lingkarLengan',
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        nama: '$infoAnak.nama',
        nik: '$infoAnak.nik',
        l: { $cond: [{ $eq: ['$infoAnak.jenisKelamin', 'L'] }, 'x', ''] },
        p: { $cond: [{ $eq: ['$infoAnak.jenisKelamin', 'P'] }, 'x', ''] },
        namaOrtu: '$infoOrtu.nama',
        rt: '$infoAnak.alamat.rt',
        rw: '$infoAnak.alamat.rw',
        alamat: `$infoAnak.alamat.dusun`,
        tanggalLahir: { $dateToString: { format: '%d/%m/%Y', date: '$infoAnak.tanggalLahir' } },
        usia: {
          $add: [
            {
              $multiply: [
                {
                  $subtract: [
                    { $year: new Date(year, bulan) },
                    { $year: '$infoAnak.tanggalLahir' },
                  ],
                },
                12,
              ],
            },
            {
              $subtract: [{ $month: new Date(year, bulan) }, { $month: '$infoAnak.tanggalLahir' }],
            },
          ],
        },
        monthlyData: 1,
      },
    },
  ];

  const results = await Record.aggregate(pipeline);

  return results.map((child) => {
    const summary = {
      nama: child.nama,
      nik: child.nik,
      l: child.l,
      p: child.p,
      tanggalLahir: child.tanggalLahir,
      usia: child.usia,
      namaOrtu: child.namaOrtu,
      rt: child.rt,
      rw: child.rw,
      alamat: child.alamat,
    };

    child.monthlyData.forEach((data) => {
      const month = data.month === 12 ? (data.year === year ? 12 : 0) : data.month;
      if (month <= bulan) {
        const monthName = reportEntity.monthNames[month];
        summary[`bb_${monthName}`] = parseFloat(data.beratBadan).toFixed(1);
        summary[`tb_${monthName}`] = parseFloat(data.tinggiBadan).toFixed(1);
        summary[`lk_${monthName}`] = data.lingkarKepala
          ? parseFloat(data.lingkarKepala).toFixed(1)
          : null;
        summary[`ll_${monthName}`] = data.lingkarLengan
          ? parseFloat(data.lingkarLengan).toFixed(1)
          : null;
      }
    });

    const firstTime = child.monthlyData.filter((data) => data.month === bulan)[0]?.pertamaKali;
    summary.pertamaKali = firstTime;

    return summary;
  });
}

const downloadReport = async (req, res) => {
  let year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
  let month = req.query.month ? parseInt(req.query.month) : null;

  try {
    const summary = await generateSummary(year, month);
    const childSummary = await getChildSummary(year, month);
    const immunisationSummary = await getImmunisationSummary(year, month);
    const filePath = await generateReport(year, month, summary, childSummary, immunisationSummary);

    if (!filePath) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate report',
      });
    }

    console.log(`Report generated at ${filePath}`);
    res.status(200).download(filePath, (err) => {
      if (err) {
        console.error(err);
      } else {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(err);
          } else {
            console.log(`File ${filePath} deleted successfully.`);
          }
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const reportController = {
  downloadReport,
};

module.exports = reportController;

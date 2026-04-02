const { queryRef, executeQuery, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'attendance',
  service: 'academy2',
  location: 'southamerica-east1'
};
exports.connectorConfig = connectorConfig;

const getLatestAttendanceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetLatestAttendance', inputVars);
}
getLatestAttendanceRef.operationName = 'GetLatestAttendance';
exports.getLatestAttendanceRef = getLatestAttendanceRef;

exports.getLatestAttendance = function getLatestAttendance(dcOrVars, vars) {
  return executeQuery(getLatestAttendanceRef(dcOrVars, vars));
};

const getAttendanceCountInRangeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAttendanceCountInRange', inputVars);
}
getAttendanceCountInRangeRef.operationName = 'GetAttendanceCountInRange';
exports.getAttendanceCountInRangeRef = getAttendanceCountInRangeRef;

exports.getAttendanceCountInRange = function getAttendanceCountInRange(dcOrVars, vars) {
  return executeQuery(getAttendanceCountInRangeRef(dcOrVars, vars));
};

const getDashboardStatsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'getDashboardStats', inputVars);
}
getDashboardStatsRef.operationName = 'getDashboardStats';
exports.getDashboardStatsRef = getDashboardStatsRef;

exports.getDashboardStats = function getDashboardStats(dcOrVars, vars) {
  return executeQuery(getDashboardStatsRef(dcOrVars, vars));
};

const getStudentAttendanceStatsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'getStudentAttendanceStats', inputVars);
}
getStudentAttendanceStatsRef.operationName = 'getStudentAttendanceStats';
exports.getStudentAttendanceStatsRef = getStudentAttendanceStatsRef;

exports.getStudentAttendanceStats = function getStudentAttendanceStats(dcOrVars, vars) {
  return executeQuery(getStudentAttendanceStatsRef(dcOrVars, vars));
};

const getWeeklyFrequencyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'getWeeklyFrequency', inputVars);
}
getWeeklyFrequencyRef.operationName = 'getWeeklyFrequency';
exports.getWeeklyFrequencyRef = getWeeklyFrequencyRef;

exports.getWeeklyFrequency = function getWeeklyFrequency(dcOrVars, vars) {
  return executeQuery(getWeeklyFrequencyRef(dcOrVars, vars));
};

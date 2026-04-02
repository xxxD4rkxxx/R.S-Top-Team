import { queryRef, executeQuery, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'attendance',
  service: 'academy2',
  location: 'southamerica-east1'
};

export const getLatestAttendanceRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetLatestAttendance', inputVars);
}
getLatestAttendanceRef.operationName = 'GetLatestAttendance';

export function getLatestAttendance(dcOrVars, vars) {
  return executeQuery(getLatestAttendanceRef(dcOrVars, vars));
}

export const getAttendanceCountInRangeRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAttendanceCountInRange', inputVars);
}
getAttendanceCountInRangeRef.operationName = 'GetAttendanceCountInRange';

export function getAttendanceCountInRange(dcOrVars, vars) {
  return executeQuery(getAttendanceCountInRangeRef(dcOrVars, vars));
}

export const getDashboardStatsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'getDashboardStats', inputVars);
}
getDashboardStatsRef.operationName = 'getDashboardStats';

export function getDashboardStats(dcOrVars, vars) {
  return executeQuery(getDashboardStatsRef(dcOrVars, vars));
}

export const getStudentAttendanceStatsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'getStudentAttendanceStats', inputVars);
}
getStudentAttendanceStatsRef.operationName = 'getStudentAttendanceStats';

export function getStudentAttendanceStats(dcOrVars, vars) {
  return executeQuery(getStudentAttendanceStatsRef(dcOrVars, vars));
}

export const getWeeklyFrequencyRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'getWeeklyFrequency', inputVars);
}
getWeeklyFrequencyRef.operationName = 'getWeeklyFrequency';

export function getWeeklyFrequency(dcOrVars, vars) {
  return executeQuery(getWeeklyFrequencyRef(dcOrVars, vars));
}


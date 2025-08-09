// addressSplitter.js - 將地址分行
/**
 * 將完整地址切割成最多三行，每行最長 35 字元
 * @param {Object} addressFields - 地址相關欄位物件
 * @param {string} addressFields.address1 - 地址行1
 * @param {string} addressFields.address2 - 地址行2
 * @param {string} addressFields.city - 城市
 * @param {string} addressFields.province - 省/州
 * @param {string} addressFields.country - 國家
 * @param {string} addressFields.zip - 郵遞區號
 * @returns {Object} 切割後的地址，包含 address1, address2, address3
 */
function splitAddress(addressFields) {
  // 合併所有地址欄位成完整地址字串（不含城市）
  const address = [
    addressFields.address1 || '',
    addressFields.address2 || '',
    addressFields.province ? addressFields.province : '',
    addressFields.country ? addressFields.country : '',
    addressFields.zip ? addressFields.zip : '',
  ]
    .filter(Boolean)
    .join(', ');

  // 設定結果物件
  const result = {
    address1: '',
    address2: '',
    address3: '',
  };

  // 如果地址為空，直接返回空結果
  if (!address) {
    return result;
  }

  // 切割地址為最多三行，每行最長35字元
  let remainingAddress = address;
  const MAX_LENGTH = 35;

  // 處理第一行
  if (remainingAddress.length <= MAX_LENGTH) {
    result.address1 = remainingAddress;
    return result;
  } else {
    // 找到最接近但不超過35字元的分割點（優先使用逗號或空格）
    let splitPoint = findSplitPoint(remainingAddress, MAX_LENGTH);
    result.address1 = remainingAddress.substring(0, splitPoint).trim();
    remainingAddress = remainingAddress.substring(splitPoint).trim();
  }

  // 處理第二行
  if (remainingAddress.length <= MAX_LENGTH) {
    result.address2 = remainingAddress;
    return result;
  } else {
    // 找到最接近但不超過35字元的分割點
    let splitPoint = findSplitPoint(remainingAddress, MAX_LENGTH);
    result.address2 = remainingAddress.substring(0, splitPoint).trim();
    remainingAddress = remainingAddress.substring(splitPoint).trim();
  }

  // 處理第三行（剩餘的部分）
  result.address3 = remainingAddress.substring(0, MAX_LENGTH).trim();

  return result;
}

/**
 * 找出地址最佳的分割點（優先使用逗號或空格）
 * @param {string} str - 待分割字串
 * @param {number} maxLength - 最大長度
 * @returns {number} 分割點位置
 */
function findSplitPoint(str, maxLength) {
  if (str.length <= maxLength) {
    return str.length;
  }

  // 尋找最後一個逗號位置
  const lastComma = str.lastIndexOf(',', maxLength);
  if (lastComma > 0) {
    return lastComma + 1; // 包含逗號
  }

  // 尋找最後一個空格位置
  const lastSpace = str.lastIndexOf(' ', maxLength);
  if (lastSpace > 0) {
    return lastSpace + 1; // 包含空格
  }

  // 如果找不到適合的分割點，就直接在最大長度處分割
  return maxLength;
}

module.exports = {
  splitAddress,
};

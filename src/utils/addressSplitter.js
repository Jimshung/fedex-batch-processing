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

// (已升級) 商業邏輯 1：處理地址分行
function splitAddress(addressFields) {
  if (!addressFields) {
    return { address1: '', address2: '', address3: '' };
  }

  // 只將 address1 和 address2 合併為一個完整的地址字串（不包含 province, country, zip）
  const fullAddress = [addressFields.address1, addressFields.address2]
    .filter(Boolean)
    .join(', ');

  if (!fullAddress) {
    return { address1: '', address2: '', address3: '' };
  }

  const MAX_LENGTH = 35;
  const addressLines = [];
  let currentAddress = fullAddress;

  // 迭代處理，直到地址處理完畢或已滿三行
  while (currentAddress.length > 0 && addressLines.length < 3) {
    if (currentAddress.length <= MAX_LENGTH) {
      addressLines.push(currentAddress);
      break;
    }

    // 如果這是第三行（最後一行），直接截取前35個字元，不再分割
    if (addressLines.length === 2) {
      addressLines.push(currentAddress.substring(0, MAX_LENGTH).trim());
      break;
    }

    // 從第 35 個字元往前找，尋找最後一個分隔符 (空格或逗號)
    let splitIndex = -1;
    for (let i = MAX_LENGTH; i >= 0; i--) {
      if (currentAddress[i] === ' ' || currentAddress[i] === ',') {
        splitIndex = i;
        break;
      }
    }
    if (splitIndex === -1) {
      splitIndex = MAX_LENGTH;
    }
    addressLines.push(currentAddress.substring(0, splitIndex).trim());
    currentAddress = currentAddress.substring(splitIndex + 1).trim();
  }

  return {
    address1: addressLines[0] || '',
    address2: addressLines[1] || '',
    address3: addressLines[2] || '',
  };
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

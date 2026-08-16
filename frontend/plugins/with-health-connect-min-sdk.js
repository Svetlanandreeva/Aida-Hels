const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withHealthConnectMinSdk(config) {
  return withGradleProperties(config, (configWithProps) => {
    const key = 'android.minSdkVersion';
    const value = '26';
    const properties = configWithProps.modResults;
    const existing = properties.find(
      (item) => item.type === 'property' && item.key === key
    );

    if (existing) {
      existing.value = value;
    } else {
      properties.push({ type: 'property', key, value });
    }

    return configWithProps;
  });
};

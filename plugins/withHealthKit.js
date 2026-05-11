const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

const withHealthKit = (config) => {
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.healthkit'] = true;
    config.modResults['com.apple.developer.healthkit.background-delivery'] = true;
    return config;
  });

  config = withInfoPlist(config, (config) => {
    config.modResults.NSHealthShareUsageDescription =
      'Healthify reads your health data to show personalised fitness insights.';
    config.modResults.NSHealthUpdateUsageDescription =
      'Healthify saves your weight logs and workout sessions to Apple Health.';
    return config;
  });

  return config;
};

module.exports = withHealthKit;

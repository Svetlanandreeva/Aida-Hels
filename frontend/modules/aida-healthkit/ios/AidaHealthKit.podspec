Pod::Spec.new do |s|
  s.name           = 'AidaHealthKit'
  s.version        = '1.0.0'
  s.summary        = 'HealthKit bridge for Aida'
  s.description    = 'Reads user-authorized Apple Health and Apple Watch metrics for the Aida health application.'
  s.author         = 'Aida'
  s.homepage       = 'https://aidaassistent.ru'
  s.platform       = :ios, '15.1'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end

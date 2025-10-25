export type InfoFieldValue = string | number | null | undefined;

export interface InfoTextFields {
  title?: InfoFieldValue;
  artist?: InfoFieldValue;
  album?: InfoFieldValue;
  bpm?: InfoFieldValue;
  key?: InfoFieldValue;
  license?: InfoFieldValue;
  attribution?: InfoFieldValue;
}

export interface InfoTextFormState {
  title: string;
  artist: string;
  album: string;
  bpm: string;
  key: string;
  license: string;
  attribution: string;
}

export const LICENSE_OPTIONS = [
  { value: 'All Rights Reserved', labelKey: 'metadata_license_option_all_rights_reserved' },
  { value: 'CC-BY 4.0', labelKey: 'metadata_license_option_cc_by_40' },
  { value: 'CC-BY', labelKey: 'metadata_license_option_cc_by' },
  { value: 'CC0', labelKey: 'metadata_license_option_cc0' }
] as const;

export const DEFAULT_INFO_TEXT_FORM: InfoTextFormState = {
  title: '',
  artist: '',
  album: '',
  bpm: '',
  key: '',
  license: '',
  attribution: ''
};

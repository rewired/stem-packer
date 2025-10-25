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

export const DEFAULT_INFO_TEXT_FORM: InfoTextFormState = {
  title: '',
  artist: '',
  album: '',
  bpm: '',
  key: '',
  license: '',
  attribution: ''
};

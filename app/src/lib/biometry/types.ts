export type BiometryType = 0 | 1 | 2 | 3 | 4;
// Plugin enum: 0 None, 1 Auto (Windows Hello), 2 TouchID, 3 FaceID, 4 Iris

export type BiometryStatus = {
  isAvailable: boolean;
  biometryType: BiometryType;
  error?: string;
  errorCode?: string;
};

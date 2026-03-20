export interface SessionData {
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl: string | null;
  employee: {
    employeeId: number;
    employeeCode: string;
    fullnameLo: string;
    fullnameEn: string | null;
    titleLo: string | null;
    titleEn: string | null;
    nickname: string | null;
    positionCode: string;
    divisionCode: string;
    departmentCode: string;
    unitCode: string;
    hireDate: string | null;
    employmentStatus: string | null;
  } | null;
}

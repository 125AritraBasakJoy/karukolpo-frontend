export const VALIDATION_MESSAGES = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  minlength: (requiredLength: number) => `Minimum length is ${requiredLength} characters`,
  maxlength: (requiredLength: number) => `Maximum length is ${requiredLength} characters`,
  pattern: 'Invalid format',
  match: 'Passwords do not match'
};

export function getValidatorErrorMessage(validatorName: string, validatorValue?: any): string {
  const messages: any = VALIDATION_MESSAGES;

  if (messages[validatorName]) {
    if (typeof messages[validatorName] === 'function') {
      return messages[validatorName](validatorValue?.requiredLength || validatorValue);
    }
    return messages[validatorName];
  }

  return 'Invalid field';
}

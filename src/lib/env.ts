// The single-file build is meant for sandboxed previews, where printing and file downloads are blocked.
export const IS_SINGLE_FILE = import.meta.env.MODE === 'single'
export const CAN_PRINT = !IS_SINGLE_FILE
export const CAN_DOWNLOAD = !IS_SINGLE_FILE

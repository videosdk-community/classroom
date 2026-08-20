import { useMediaDevice } from '@videosdk.live/react-sdk'
import { warn } from '../log'

/* Device enumeration, normalised to one shape.

   The SDK offers two families with DIFFERENT names on either side of
   MeetingProvider: getCameras/getMicrophones outside it, getWebcams/getMics
   inside. They also return different shapes. Both are flattened to
   MediaDeviceOption so the picker component is the same on both sides and no
   feature code has to know which side of the provider it is on. */

export interface MediaDeviceOption {
  id: string
  label: string
}

function toOption(d: { deviceId?: string; label?: string }, index: number, kind: string): MediaDeviceOption {
  return {
    id: d.deviceId ?? '',
    /* Labels are empty until permission is granted; a numbered fallback beats
       a list of blank rows. */
    label: d.label || `${kind} ${index + 1}`,
  }
}

/** Outside MeetingProvider. */
export function usePrecallDevices() {
  const { getCameras, getMicrophones } = useMediaDevice()

  return {
    async cameras(): Promise<MediaDeviceOption[]> {
      try {
        return (await getCameras()).map((d, i) => toOption(d, i, 'Camera'))
      } catch (err) {
        warn('getCameras failed', err)
        return []
      }
    },
    async microphones(): Promise<MediaDeviceOption[]> {
      try {
        return (await getMicrophones()).map((d, i) => toOption(d, i, 'Microphone'))
      } catch (err) {
        warn('getMicrophones failed', err)
        return []
      }
    },
  }
}

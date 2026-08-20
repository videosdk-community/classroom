import { createCameraVideoTrack, createMicrophoneAudioTrack } from '@videosdk.live/react-sdk'

/* Precall tracks.

   plan.md lists these two factories as members of useMediaDevice. They are
   not: the hook returns exactly getDevices, getCameras, getMicrophones,
   getPlaybackDevices, checkPermissions and requestPermission. These are
   top-level named exports of the package. Destructuring them off the hook
   yields undefined and fails at call time, not at build time, which is the
   worst place to find out.

   Both return a MediaStream rather than a track, which is exactly what
   MeetingProvider's customCameraVideoTrack / customMicrophoneAudioTrack
   expect, so nothing needs unwrapping. */

/* A hang here is worse than a failure: the preview never appears, nothing is
   logged, and it reads as "the camera is off". getUserMedia can genuinely
   never settle when the device is contended, so every acquisition is raced
   against a deadline and a timeout is reported like any other error. */
export async function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not respond within ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

export function createPreviewCamera(cameraId?: string) {
  return withTimeout(
    createCameraVideoTrack({ cameraId, optimizationMode: 'motion', multiStream: false }),
    8000,
    'the camera',
  )
}

export function createPreviewMicrophone(microphoneId?: string) {
  return withTimeout(createMicrophoneAudioTrack({ microphoneId }), 8000, 'the microphone')
}

/** Every replaced track must be stopped or the OS camera light stays on and
    the handles accumulate. One helper so there is one place to get it right. */
export function stopStream(stream: MediaStream | undefined | null) {
  stream?.getTracks().forEach((t) => t.stop())
}

#ifndef MIG_C_API_H
#define MIG_C_API_H
#include <stddef.h>
#include <stdint.h>
#if defined(_WIN32)
#if defined(MIG_C_EXPORTS)
#define MIG_C_API __declspec(dllexport)
#else
#define MIG_C_API __declspec(dllimport)
#endif
#else
#define MIG_C_API __attribute__((visibility("default")))
#endif
#ifdef __cplusplus
extern "C" {
#endif
typedef struct mig_tracker mig_tracker;
/* ABI 1: fixed-width, caller-owned packets, anatomical/unmirrored coordinates.
   body[joint*8]: x,y,z,confidence,world_x,world_y,world_z,world_valid (0/1).
   hands[(hand*21+joint)*6]: image XYZ, world XYZ. Missing body confidence is 0.
   Serialize all calls per handle. No callbacks or ownership transfer. */
typedef struct mig_packet {
    int64_t timestamp_ms;
    uint64_t sequence;
    float aspect;
    uint32_t hand_count;
    uint32_t hand_world_mask;
    float body[33 * 8];
    float hands[2 * 21 * 6];
} mig_packet;
MIG_C_API unsigned mig_abi_version(void);
MIG_C_API size_t mig_packet_size(void);
/* Error text is thread-local; copy before the next failing call on this thread. */
MIG_C_API const char* mig_last_error(void);
MIG_C_API mig_tracker* mig_create(const char* json);
MIG_C_API void mig_destroy(mig_tracker* tracker);
/* Failed import preserves the current profile. Successful import closes capture. */
MIG_C_API int mig_load(mig_tracker* tracker, const char* json);
/* Required byte count including NUL. Copies only if capacity is sufficient. */
MIG_C_API size_t mig_export(mig_tracker* tracker, char* buffer, size_t capacity);
/* Return event count, or -1 for invalid arguments/failure. Invalid packets reset state. */
MIG_C_API int mig_update(mig_tracker* tracker, const mig_packet* packet);
/* Borrowed UTF-8 strings valid until update/import/reset/destroy. */
MIG_C_API const char* mig_event_action(mig_tracker* tracker, unsigned index);
MIG_C_API const char* mig_event_id(mig_tracker* tracker, unsigned index);
MIG_C_API int mig_active(mig_tracker* tracker, unsigned input);
/* systems: 0 image, 1 world metres, 2 world Y-up; output XYZ + confidence.
   Return 1 present, 0 missing/invalid. Hand side: 0 anatomical left, 1 right. */
MIG_C_API int mig_coordinate(mig_tracker* tracker, int landmark, int system, float* xyzw);
MIG_C_API int mig_hand_coordinate(mig_tracker* tracker, int side, int joint, int system,
                                  float* xyzw);
MIG_C_API void mig_reset(mig_tracker* tracker, int recalibrate);
/* Optional native capture: same owning thread starts/polls/stops it. Explicit
   runtime directory with models and libmediapipe. -1 if capability unavailable.
   poll: -1 failure, 0 timeout, 1 new packet. Packet is filled AND recognized;
   use mig_event_count afterwards, do not call update again on that packet. */
MIG_C_API int mig_camera_start(mig_tracker* tracker, const char* runtime, unsigned index);
/* Additive ABI-1 extension: same as mig_camera_start with a pose model name
   ("lite", "full" or "heavy"). NULL or empty keeps the default "lite". The model
   must be bundled in runtime/models or already present in the user model cache. */
MIG_C_API int mig_camera_start_model(mig_tracker* tracker, const char* runtime, unsigned index,
                                     const char* model);
MIG_C_API int mig_camera_poll(mig_tracker* tracker, mig_packet* packet);
/* Borrowed packed RGB24 preview, unmirrored, valid until the next poll/stop/import
   or destroy. Returns 1 present, 0 unavailable/invalid. Copy on the owning thread
   before handing pixels to another thread. No camera is opened by this query. */
MIG_C_API int mig_camera_image(mig_tracker* tracker, const uint8_t** rgb, unsigned* width,
                               unsigned* height);
MIG_C_API void mig_camera_stop(mig_tracker* tracker);
MIG_C_API unsigned mig_event_count(mig_tracker* tracker);
#ifdef __cplusplus
}
#endif
#endif

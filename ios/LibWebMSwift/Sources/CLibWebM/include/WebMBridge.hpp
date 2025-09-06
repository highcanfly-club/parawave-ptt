#ifndef WEBM_BRIDGE_HPP
#define WEBM_BRIDGE_HPP

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Opaque handles for Swift interop
typedef void *WebMParserHandle;
typedef void *WebMMuxerHandle;
typedef void *WebMSegmentHandle;
typedef void *WebMWriterHandle;

// Error codes
typedef enum {
  WEBM_SUCCESS = 0,
  WEBM_ERROR_INVALID_FILE = -1,
  WEBM_ERROR_CORRUPTED_DATA = -2,
  WEBM_ERROR_UNSUPPORTED_FORMAT = -3,
  WEBM_ERROR_IO_ERROR = -4,
  WEBM_ERROR_OUT_OF_MEMORY = -5,
  WEBM_ERROR_INVALID_ARGUMENT = -6
} WebMErrorCode;

// Parser API
WebMParserHandle webm_parser_create(const char *filepath);
void webm_parser_destroy(WebMParserHandle parser);
WebMErrorCode webm_parser_parse_headers(WebMParserHandle parser);
WebMErrorCode webm_parser_get_duration(WebMParserHandle parser,
                                       double *duration);
WebMErrorCode webm_parser_get_track_count(WebMParserHandle parser,
                                          uint32_t *count);

// Track information
typedef struct {
  uint32_t track_number;
  uint32_t track_type; // 1=video, 2=audio, 3=complex, 4=logo, 5=subtitle,
                       // 6=buttons, 7=control
  char codec_id[32];
  char name[256];
  char language[4];
  uint64_t default_duration;
  double timecode_scale;
} WebMTrackInfo;

WebMErrorCode webm_parser_get_track_info(WebMParserHandle parser,
                                         uint32_t track_index,
                                         WebMTrackInfo *info);

// Video track specific info
typedef struct {
  uint32_t width;
  uint32_t height;
  uint32_t display_width;
  uint32_t display_height;
  double frame_rate;
} WebMVideoInfo;

WebMErrorCode webm_parser_get_video_info(WebMParserHandle parser,
                                         uint32_t track_number,
                                         WebMVideoInfo *info);

// Audio track specific info
typedef struct {
  double sampling_frequency;
  uint32_t channels;
  uint32_t bit_depth;
} WebMAudioInfo;

WebMErrorCode webm_parser_get_audio_info(WebMParserHandle parser,
                                         uint32_t track_number,
                                         WebMAudioInfo *info);

// Muxer API
WebMMuxerHandle webm_muxer_create(const char *filepath);
void webm_muxer_destroy(WebMMuxerHandle muxer);
WebMErrorCode webm_muxer_finalize(WebMMuxerHandle muxer);

// Track management
typedef uint32_t WebMTrackID;

WebMTrackID webm_muxer_add_video_track(WebMMuxerHandle muxer, uint32_t width,
                                       uint32_t height, const char *codec_id);

WebMTrackID webm_muxer_add_audio_track(WebMMuxerHandle muxer,
                                       double sampling_frequency,
                                       uint32_t channels, const char *codec_id);

// Frame writing
WebMErrorCode
webm_muxer_write_video_frame(WebMMuxerHandle muxer, WebMTrackID track_id,
                             const uint8_t *frame_data, size_t frame_size,
                             uint64_t timestamp_ns, bool is_keyframe);

WebMErrorCode webm_muxer_write_audio_frame(WebMMuxerHandle muxer,
                                           WebMTrackID track_id,
                                           const uint8_t *frame_data,
                                           size_t frame_size,
                                           uint64_t timestamp_ns);

// Callback-based I/O for streaming
typedef struct {
  void *context;
  int64_t (*read)(void *context, void *buffer, size_t size);
  int64_t (*seek)(void *context, int64_t offset, int whence);
  int64_t (*tell)(void *context);
  int (*eof)(void *context);
} WebMReaderCallbacks;

WebMParserHandle
webm_parser_create_with_callbacks(WebMReaderCallbacks callbacks);
WebMMuxerHandle webm_muxer_create_with_callbacks(WebMReaderCallbacks callbacks);

// Utility functions
const char *webm_error_string(WebMErrorCode error);

#ifdef __cplusplus
}
#endif

#endif // WEBM_BRIDGE_HPP

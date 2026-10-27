import add from '@material-symbols/svg-400/outlined/add.svg?raw'
import build from '@material-symbols/svg-400/outlined/build.svg?raw'
import database from '@material-symbols/svg-400/outlined/database.svg?raw'
import download from '@material-symbols/svg-400/outlined/download.svg?raw'
import draw from '@material-symbols/svg-400/outlined/draw.svg?raw'
import edit from '@material-symbols/svg-400/outlined/edit.svg?raw'
import folderZip from '@material-symbols/svg-400/outlined/folder_zip.svg?raw'
import graphicEq from '@material-symbols/svg-400/outlined/graphic_eq.svg?raw'
import keyboardArrowDown from '@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?raw'
import lightbulb from '@material-symbols/svg-400/outlined/lightbulb.svg?raw'
import localShipping from '@material-symbols/svg-400/outlined/local_shipping.svg?raw'
import mic from '@material-symbols/svg-400/outlined/mic.svg?raw'
import photoLibrary from '@material-symbols/svg-400/outlined/photo_library.svg?raw'
import share from '@material-symbols/svg-400/outlined/share.svg?raw'
import stopCircle from '@material-symbols/svg-400/outlined/stop_circle.svg?raw'
import undo from '@material-symbols/svg-400/outlined/undo.svg?raw'
import videocam from '@material-symbols/svg-400/outlined/videocam.svg?raw'
import warning from '@material-symbols/svg-400/outlined/warning.svg?raw'
import arrowBack from '@material-symbols/svg-400/outlined/arrow_back.svg?raw'
import arrowForward from '@material-symbols/svg-400/outlined/arrow_forward.svg?raw'
import check from '@material-symbols/svg-400/outlined/check.svg?raw'
import checkCircle from '@material-symbols/svg-400/outlined/check_circle.svg?raw'
import chevronRight from '@material-symbols/svg-400/outlined/chevron_right.svg?raw'
import close from '@material-symbols/svg-400/outlined/close.svg?raw'
import remove from '@material-symbols/svg-400/outlined/delete.svg?raw'
import error from '@material-symbols/svg-400/outlined/error.svg?raw'
import inbox from '@material-symbols/svg-400/outlined/inbox.svg?raw'
import info from '@material-symbols/svg-400/outlined/info.svg?raw'
import photoCamera from '@material-symbols/svg-400/outlined/photo_camera.svg?raw'

const icons = {
  add,
  build,
  database,
  download,
  draw,
  edit,
  folder_zip: folderZip,
  graphic_eq: graphicEq,
  keyboard_arrow_down: keyboardArrowDown,
  lightbulb,
  local_shipping: localShipping,
  mic,
  photo_library: photoLibrary,
  share,
  stop_circle: stopCircle,
  undo,
  videocam,
  warning,
  arrow_back: arrowBack,
  arrow_forward: arrowForward,
  check,
  check_circle: checkCircle,
  chevron_right: chevronRight,
  close,
  delete: remove,
  error,
  inbox,
  info,
  photo_camera: photoCamera,
}

export type IconName = keyof typeof icons

type IconProps = { name: IconName; size?: number; label?: string }

export function Icon({ name, size = 24, label }: IconProps) {
  return (
    <span
      className="icon"
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: icons[name] }}
    />
  )
}

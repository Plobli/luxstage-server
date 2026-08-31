import * as m001 from './001-lighting-checks.js'
import * as m002 from './002-users-preferences.js'
import * as m003 from './003-shows-columns.js'
import * as m004 from './004-section-kv-rows.js'
import * as m005 from './005-template-section-kv-rows.js'
import * as m006 from './006-templates-columns.js'
import * as m007 from './007-channel-photos.js'
import * as m008 from './008-template-floorplans-canvas-data.js'
import * as m009 from './009-show-floorplan-layers-columns.js'
import * as m010 from './010-towers.js'
import * as m011 from './011-channels-mount-ref-quantity.js'
import * as m012 from './012-bars.js'
import * as m013 from './013-bars-height-notes.js'
import * as m014 from './014-bars-hide-scale.js'
import * as m015 from './015-bar-fixtures-notes.js'
import * as m016 from './016-bar-fixtures-drop-unique.js'
import * as m017 from './017-towers-notes.js'
import * as m018 from './018-bars-bar-type.js'
import * as m019 from './019-bar-fixtures-side.js'
import * as m020 from './020-bar-fixtures-position-text.js'
import * as m021 from './021-template-bars.js'
import * as m022 from './022-template-bars-bar-type.js'
import * as m023 from './023-section-defs-rename.js'
import * as m024 from './024-section-defs-icon.js'
import * as m025 from './025-template-towers.js'
import * as m026 from './026-template-bar-fixtures.js'
import * as m027 from './027-template-bar-fixtures-side.js'
import * as m028 from './028-template-bar-fixtures-position-text.js'
import * as m029 from './029-photo-channels-migrate.js'
import * as m030 from './030-channels-default-nc-color.js'
import * as m031 from './031-operations-table.js'
import * as m032 from './032-users-drop-role.js'
import * as m033 from './033-users-pending-flag.js'
import * as m034 from './034-network-tables.js'
import * as m035 from './035-network-nodes-port-count.js'
import * as m036 from './036-network-nodes-position.js'
import * as m037 from './037-network-layout-snapshot.js'
import * as m038 from './038-network-nodes-is-main.js'
import * as m039 from './039-operations-full-snapshot.js'
import * as m040 from './040-network-operations.js'

// Reihenfolge ist bindend — manche Migrationen setzen das Ergebnis vorheriger
// voraus (z.B. 024 liest Titel, die erst durch 023 umbenannt wurden).
export const migrations = [
  m001, m002, m003, m004, m005, m006, m007, m008, m009, m010,
  m011, m012, m013, m014, m015, m016, m017, m018, m019, m020,
  m021, m022, m023, m024, m025, m026, m027, m028, m029, m030,
  m031, m032, m033, m034, m035, m036, m037, m038, m039, m040,
]

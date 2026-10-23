param(
  [Parameter(Mandatory=$true)][ValidateSet('01','03','04')][string]$Plate,
  [string]$Which = 'abc'
)

$ErrorActionPreference = 'Stop'
$gen = 'C:\Users\17600\.dsh\skills\gpt-image\gen.js'
$raw = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\raw'))

$P = @{
'01' = @{
 'a' = 'Extreme close-up photograph of a weathered basalt sea wall, Hainan. Black porous volcanic rock crusted with a thin shell of white coral limestone, dusted with grey volcanic ash, streaks of rust-red iron oxidation bleeding into the stone. Hard low tropical sunlight rakes across the surface from the upper left, highlights blown to bone white, cracks falling to pure black. Shallow depth of field: one narrow band of rock tack sharp, the rest dissolving into smooth grey. Matte, dusty, slightly underexposed, fine 35mm grain, restrained color. Documentary natural history specimen plate, flat frontal composition, no horizon, no sky, no glare, no lens flare. No text, no letters, no numbers, no watermark, no people, no hands.'
 'b' = 'Macro photograph of volcanic basalt and pale coral limestone in direct contact, seen flat on like a geological specimen plate. Pitted black-grey basalt full of gas vesicles, ash-grey dust packed into the crevices, a chalky dead-coral crust growing across one corner, rust-red mineral stain along the seam. Harsh tropical midday sun from above, one hard shadow edge, almost monochrome with rust accents only. Extremely shallow focus, edges dissolving into soft grey. Analogue, matte, slightly underexposed, fine film grain, no gloss, no glare, no lens flare. No text, no letters, no numbers, no watermark, no people, no hands.'
 'c' = 'Macro view of the dry line where the tide has just left a basalt rock shelf. A dark wet band of black volcanic stone meets dry ash-grey stone dusted with a bloom of salt and a chalky ridge of dead coral limestone. Hard low tropical light from the side, long raking shadow, rust-red iron staining in the wet stone. Shallow depth of field, matte, desaturated except for the rust, fine film grain. Documentary natural history plate, flat composition, no horizon, no sky. No text, no letters, no numbers, no watermark, no people.'
}
'03' = @{
 'a' = 'Extreme macro photograph of a living stony coral colony spawning, seen in a dark field. A dense field of small translucent polyps with fine extended tentacles, polyp mouths rimmed coral red, a few pale egg bundles like tiny pearls drifting in the water. Deep teal and near-black background, one soft top light, thin water haze. Only a few polyps tack sharp, everything else dissolving into dark teal. Scientific specimen plate, matte, low-key, fine grain, no turquoise tourist reef color, no HDR glow, no bloom, no fish, no diver, no hands. No text, no letters, no numbers, no watermark.'
 'b' = 'Side-lit macro of coral spawning at night in a dark field: the tip of a branching staghorn coral, tiny polyps fully extended, each ringed with fluorescent cyan tissue, red polyp mouths, a scatter of pale egg bundles suspended in the water. Background falls from deep teal to black. Shallow depth of field, matte palette, documentary grain, no aqua-blue reef lighting, no glow bloom, no fish, no diver. No text, no letters, no numbers, no watermark.'
 'c' = 'Overhead macro of a brain coral surface, its meandering ridges and valleys packed with tiny open polyps, spawning egg bundles rising off the ridges. Colors held to deep teal shadow, dark olive black, coral red in the polyp mouths and a fluorescent cyan sheen on the ridge crests. Dark field, single raking light, shallow depth of field. Natural history plate, matte, fine grain, no HDR, no bloom, no fish, no text, no letters, no numbers, no watermark.'
}
'04' = @{
 'a' = 'Flat overhead scan of an aged hand-drawn sea route chart on old Chinese handmade paper, in the manner of a 19th century route book. Warm tea-stained fibre paper with foxing, fold creases and faint water rings. Thin hand-inked coastline and reef outlines, small open circles marking shoals, dotted and dashed sailing routes crossing the sheet, a small compass rosette, scattered cinnabar red waypoint dots and pale gold star flecks. Fine brush-pen linework with slightly uneven pressure. There is no writing of any kind: no characters, no letters, no numerals, no labels, no title, no captions, no modern map interface, no fake glyphs. Flat even light, matte aged surface, subtle fibre grain. No people.'
 'b' = 'Detail crop of an old hand-drawn navigation chart: many fine ink route lines converging on an empty centre, dotted sailing tracks, tiny open circles for reefs, a cinnabar red dot at each junction, a few pale gold star specks scattered like a star chart, coast outlines in a thin wavering line. Aged ivory paper with fibre, foxing and one soft water stain. No writing at all: no characters, no letters, no numerals, no labels, no fake glyphs, no title block. Overhead flat light, matte, subtle paper grain, fine pen linework.'
 'c' = 'Overhead photograph of a folded, aged hand-drawn route chart opened flat: thin wavering ink coastlines, dotted route lines with small arrowheads, open circles for shoals, cinnabar waypoint dots, faint pale-gold star marks in one corner, a small compass rose drawn only in lines. Tea-stained ivory paper, foxing, fold lines, soft shadow at a slight page curl. Absolutely no writing, no characters, no letters, no numerals, no labels, no seals with text, no fake glyphs. Matte paper, flat even light, subtle fibre grain.'
}
}

foreach ($c in $Which.ToCharArray()) {
  $v = [string]$c
  $prompt = $P[$Plate][$v]
  if (-not $prompt) { throw "no prompt for $Plate/$v" }
  Write-Output "[$Plate/$v] generating..."
  $out = & node $gen --prompt $prompt --size 1536x1024 --quality high --format png --outdir $raw 2>&1
  $txt = ($out | Out-String).Trim()
  try { $j = $txt | ConvertFrom-Json } catch { Write-Output "RAW OUTPUT: $txt"; throw "gen failed for $Plate/$v" }
  if (-not $j.saved -or $j.saved.Count -eq 0) { Write-Output "RAW OUTPUT: $txt"; throw "no saved file for $Plate/$v" }
  $src = $j.saved[0]
  $dst = Join-Path $raw ("{0}-{1}.png" -f $Plate, $v)
  Move-Item -Force $src $dst
  Write-Output ("[$Plate/$v] saved -> " + $dst)
}
Write-Output "DONE $Plate"

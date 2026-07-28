$BASE = "ERPFiat-Portatil\resources"
$TMP = [System.IO.Path]::GetTempPath()

function Clean-Dark($f) {
    $c = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
    $c = [regex]::Replace($c, "(?s)`r?`n\[data-theme=.dark.\].*$", "")
    [System.IO.File]::WriteAllText($f, $c, [System.Text.Encoding]::UTF8)
}

# hub/hub.css
$f = "$BASE\hub\hub.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7CiAgLS1iZzogIzBkMTExNzsgLS1zdXJmYWNlOiAjMTYxYjIyOyAtLXN1cmZhY2UyOiAjMjEyNjJkOyAtLWJvcmRlcjogIzMwMzYzZDsKICAtLWJsdWU6ICMzODhiZmQ7IC0tYmx1ZS1taWQ6ICM1OGE2ZmY7IC0tYmx1ZS1saWdodDogIzc5YzBmZjsgLS1ibHVlLXBhbGU6ICMxZjMzNTg7CiAgLS1nbjogIzNmYjk1MDsgLS15dzogI2QyOTkyMjsgLS1yZDogI2Y4NTE0OTsgLS1vcjogI2UzODM0YTsKICAtLXRleHQ6ICNlNmVkZjM7IC0tdGV4dC1tdXRlZDogIzhiOTQ5ZTsgLS10ZXh0LWRpbTogIzQ4NGY1ODsKICAtLXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwwLDAsLjUpOyBjb2xvci1zY2hlbWU6IGRhcms7Cn0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubW9kLWNhcmQgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlKTsgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gLmFjYXJkIHsgYmFja2dyb3VuZDogdmFyKC0tc3VyZmFjZTIpOyBib3JkZXItY29sb3I6IHZhcigtLWJvcmRlcik7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSBzZWxlY3QsW2RhdGEtdGhlbWU9ImRhcmsiXSBpbnB1dCxbZGF0YS10aGVtZT0iZGFyayJdIHRleHRhcmVhIHsgYmFja2dyb3VuZDogdmFyKC0tc3VyZmFjZTIpOyBjb2xvcjogdmFyKC0tdGV4dCk7IGJvcmRlci1jb2xvcjogdmFyKC0tYm9yZGVyKTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIG9wdGlvbiB7IGJhY2tncm91bmQ6ICMyMTI2MmQ7IGNvbG9yOiAjZTZlZGYzOyB9"))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# kpi/kpi.css
$f = "$BASE\kpi\kpi.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7CiAgLS1iZzogIzBkMTExNzsgLS1zdXJmYWNlOiAjMTYxYjIyOyAtLXN1cmZhY2UyOiAjMjEyNjJkOyAtLWJvcmRlcjogIzMwMzYzZDsKICAtLWJsdWU6ICMzODhiZmQ7IC0tYmx1ZS1taWQ6ICM1OGE2ZmY7IC0tYmx1ZS1saWdodDogIzc5YzBmZjsgLS1ibHVlLXBhbGU6ICMxZjMzNTg7CiAgLS1ncmVlbjogIzNmYjk1MDsgLS15ZWxsb3c6ICNkMjk5MjI7IC0tcmVkOiAjZjg1MTQ5OyAtLW9yYW5nZTogI2UzODM0YTsgLS1wdXJwbGU6ICNiYzhjZmY7CiAgLS1ncmVlbi1iZzogIzBkMmIxYTsgLS15ZWxsb3ctYmc6ICMyYjI2MGQ7IC0tcmVkLWJnOiAjMmIwZDBkOyAtLW9yYW5nZS1iZzogIzJiMWEwZDsKICAtLXRleHQ6ICNlNmVkZjM7IC0tdGV4dC1tdXRlZDogIzhiOTQ5ZTsgLS10ZXh0LWRpbTogIzQ4NGY1ODsgY29sb3Itc2NoZW1lOiBkYXJrOwp9CltkYXRhLXRoZW1lPSJkYXJrIl0gLmRvbnV0LWxlZy1wY3QsW2RhdGEtdGhlbWU9ImRhcmsiXSAub2ItbGVnLXZhbCB7IGNvbG9yOiB2YXIoLS10ZXh0KTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIC5kb251dC1sZWctdHh0LFtkYXRhLXRoZW1lPSJkYXJrIl0gLm9iLWxlZy10eHQgeyBjb2xvcjogdmFyKC0tdGV4dC1tdXRlZCk7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSAuZXF1aXBlLW9mZmxpbmUgeyBiYWNrZ3JvdW5kOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gc2VsZWN0LFtkYXRhLXRoZW1lPSJkYXJrIl0gaW5wdXQsW2RhdGEtdGhlbWU9ImRhcmsiXSB0ZXh0YXJlYSB7IGJhY2tncm91bmQ6IHZhcigtLXN1cmZhY2UyKTsgY29sb3I6IHZhcigtLXRleHQpOyBib3JkZXItY29sb3I6IHZhcigtLWJvcmRlcik7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSBvcHRpb24geyBiYWNrZ3JvdW5kOiAjMjEyNjJkOyBjb2xvcjogI2U2ZWRmMzsgfQ=="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# capex/capex.css
$f = "$BASE\capex\capex.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7CiAgLS1iZzogIzBkMTExNzsgLS1zdXJmYWNlOiAjMTYxYjIyOyAtLXN1cmZhY2UyOiAjMjEyNjJkOyAtLWJvcmRlcjogIzMwMzYzZDsKICAtLWJsdWU6ICMzODhiZmQ7IC0tYmx1ZS1taWQ6ICM1OGE2ZmY7IC0tYmx1ZS1saWdodDogIzc5YzBmZjsgLS1ibHVlLXBhbGU6ICMxZjMzNTg7CiAgLS1ncmVlbjogIzNmYjk1MDsgLS1ncmVlbi1wYWxlOiAjMGQyYjFhOyAtLXllbGxvdzogI2QyOTkyMjsgLS15ZWxsb3ctcGFsZTogIzJiMjYwZDsKICAtLXJlZDogI2Y4NTE0OTsgLS1yZWQtcGFsZTogIzJiMGQwZDsgLS1vcmFuZ2U6ICNlMzgzNGE7CiAgLS10ZXh0OiAjZTZlZGYzOyAtLXRleHQtbXV0ZWQ6ICM4Yjk0OWU7IC0tdGV4dC1kaW06ICM0ODRmNTg7IGNvbG9yLXNjaGVtZTogZGFyazsKfQpbZGF0YS10aGVtZT0iZGFyayJdIC5tb2RhbCB7IGJhY2tncm91bmQ6IHZhcigtLXN1cmZhY2UpOyBib3JkZXItY29sb3I6IHZhcigtLWJvcmRlcik7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubW9kYWwtb3ZlcmxheSB7IGJhY2tncm91bmQ6IHJnYmEoMCwwLDAsLjc1KTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIHNlbGVjdCxbZGF0YS10aGVtZT0iZGFyayJdIGlucHV0LFtkYXRhLXRoZW1lPSJkYXJrIl0gdGV4dGFyZWEgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gb3B0aW9uIHsgYmFja2dyb3VuZDogIzIxMjYyZDsgY29sb3I6ICNlNmVkZjM7IH0="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# conforto/conforto.css
$f = "$BASE\conforto\conforto.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7CiAgLS1iZzogIzBkMTExNzsgLS1zdXJmYWNlOiAjMTYxYjIyOyAtLXN1cmZhY2UyOiAjMjEyNjJkOyAtLWJvcmRlcjogIzMwMzYzZDsKICAtLWJsdWU6ICMzODhiZmQ7IC0tYmx1ZS1taWQ6ICM1OGE2ZmY7IC0tYmx1ZS1saWdodDogIzc5YzBmZjsgLS1ibHVlLXBhbGU6ICMxZjMzNTg7CiAgLS1ncmVlbjogIzNmYjk1MDsgLS15ZWxsb3c6ICNkMjk5MjI7IC0tb3JhbmdlOiAjZTM4MzRhOyAtLXJlZDogI2Y4NTE0OTsKICAtLXRleHQ6ICNlNmVkZjM7IC0tdGV4dC1tdXRlZDogIzhiOTQ5ZTsgY29sb3Itc2NoZW1lOiBkYXJrOwp9CltkYXRhLXRoZW1lPSJkYXJrIl0gLmJhZGdlLWdyZWVuIHsgYmFja2dyb3VuZDogIzBkMmIxYTsgY29sb3I6ICMzZmI5NTA7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSAuYmFkZ2UteWVsbG93IHsgYmFja2dyb3VuZDogIzJiMjYwZDsgY29sb3I6ICNkMjk5MjI7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSAuYmFkZ2UtcmVkIHsgYmFja2dyb3VuZDogIzJiMGQwZDsgY29sb3I6ICNmODUxNDk7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSAuYmFkZ2UtbXV0ZWQgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IGNvbG9yOiB2YXIoLS10ZXh0LW11dGVkKTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIC5hY3Rpb24tYnRuLmRhbmdlcjpob3ZlciB7IGJhY2tncm91bmQ6ICMyYjBkMGQ7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSAudWMtY2FyZCB7IGJhY2tncm91bmQ6IHZhcigtLXN1cmZhY2UpOyBib3JkZXItY29sb3I6IHZhcigtLWJvcmRlcik7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubW9kYWwgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlKTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIC5tb2RhbC1vdmVybGF5IHsgYmFja2dyb3VuZDogcmdiYSgwLDAsMCwuNzUpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gc2VsZWN0LFtkYXRhLXRoZW1lPSJkYXJrIl0gaW5wdXQsW2RhdGEtdGhlbWU9ImRhcmsiXSB0ZXh0YXJlYSB7IGJhY2tncm91bmQ6IHZhcigtLXN1cmZhY2UyKTsgY29sb3I6IHZhcigtLXRleHQpOyBib3JkZXItY29sb3I6IHZhcigtLWJvcmRlcik7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSBvcHRpb24geyBiYWNrZ3JvdW5kOiAjMjEyNjJkOyBjb2xvcjogI2U2ZWRmMzsgfQ=="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# chamados/chamados.css
$f = "$BASE\chamados\chamados.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7CiAgLS1iZzogIzBkMTExNzsgLS1zdXJmYWNlOiAjMTYxYjIyOyAtLXN1cmZhY2UyOiAjMjEyNjJkOyAtLXN1cmZhY2UzOiAjMmQzMzNiOyAtLWJvcmRlcjogIzMwMzYzZDsKICAtLWJsdWU6ICMzODhiZmQ7IC0tYmx1ZS1taWQ6ICM1OGE2ZmY7IC0tYmx1ZS1saWdodDogIzc5YzBmZjsKICAtLWdyZWVuOiAjM2ZiOTUwOyAtLXllbGxvdzogI2QyOTkyMjsgLS1yZWQ6ICNmODUxNDk7IC0tb3JhbmdlOiAjZTM4MzRhOwogIC0tdGV4dDogI2U2ZWRmMzsgLS10ZXh0LW11dGVkOiAjOGI5NDllOyAtLXRleHQtZGltOiAjNDg0ZjU4OyBjb2xvci1zY2hlbWU6IGRhcms7Cn0KW2RhdGEtdGhlbWU9ImRhcmsiXSAucXItY2FudmFzLXdyYXAgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubW9kYWwgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlKTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIC5tb2RhbC1vdmVybGF5IHsgYmFja2dyb3VuZDogcmdiYSgwLDAsMCwuNzUpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gc2VsZWN0LFtkYXRhLXRoZW1lPSJkYXJrIl0gaW5wdXQsW2RhdGEtdGhlbWU9ImRhcmsiXSB0ZXh0YXJlYSB7IGJhY2tncm91bmQ6IHZhcigtLXN1cmZhY2UyKTsgY29sb3I6IHZhcigtLXRleHQpOyBib3JkZXItY29sb3I6IHZhcigtLWJvcmRlcik7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSBvcHRpb24geyBiYWNrZ3JvdW5kOiAjMjEyNjJkOyBjb2xvcjogI2U2ZWRmMzsgfQ=="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# admin/admin.css
$f = "$BASE\admin\admin.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7CiAgLS1iZzogIzBkMTExNzsgLS1zdXJmYWNlOiAjMTYxYjIyOyAtLXN1cmZhY2UyOiAjMjEyNjJkOyAtLWJvcmRlcjogIzMwMzYzZDsKICAtLWJsdWU6ICMzODhiZmQ7IC0tYmx1ZS1taWQ6ICM1OGE2ZmY7IC0tYmx1ZS1saWdodDogIzc5YzBmZjsgLS1ibHVlLXBhbGU6ICMxZjMzNTg7CiAgLS1nbjogIzNmYjk1MDsgLS15dzogI2QyOTkyMjsgLS1yZDogI2Y4NTE0OTsKICAtLXRleHQ6ICNlNmVkZjM7IC0tdGV4dC1tdXRlZDogIzhiOTQ5ZTsgLS10ZXh0LWRpbTogIzQ4NGY1ODsgY29sb3Itc2NoZW1lOiBkYXJrOwp9CltkYXRhLXRoZW1lPSJkYXJrIl0gLmJhZGdlLXJvbGUuYWRtaW4geyBiYWNrZ3JvdW5kOiAjMmIwZDBkOyBjb2xvcjogI2Y4NTE0OTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIC5iYWRnZS1yb2xlLm9wZXJhZG9yIHsgYmFja2dyb3VuZDogIzBkMmIxYTsgY29sb3I6ICMzZmI5NTA7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSBzZWxlY3QsW2RhdGEtdGhlbWU9ImRhcmsiXSBpbnB1dCxbZGF0YS10aGVtZT0iZGFyayJdIHRleHRhcmVhIHsgYmFja2dyb3VuZDogdmFyKC0tc3VyZmFjZTIpOyBjb2xvcjogdmFyKC0tdGV4dCk7IGJvcmRlci1jb2xvcjogdmFyKC0tYm9yZGVyKTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIG9wdGlvbiB7IGJhY2tncm91bmQ6ICMyMTI2MmQ7IGNvbG9yOiAjZTZlZGYzOyB9"))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# obras/obras.css
$f = "$BASE\obras\obras.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7CiAgLS1iZzogIzBkMTExNzsgLS1zdXJmYWNlOiAjMTYxYjIyOyAtLXN1cmZhY2UyOiAjMjEyNjJkOyAtLWJvcmRlcjogIzMwMzYzZDsKICAtLWJsdWU6ICMzODhiZmQ7IC0tYmx1ZS1taWQ6ICM1OGE2ZmY7IC0tYmx1ZS1saWdodDogIzc5YzBmZjsgLS1ibHVlLXBhbGU6ICMxZjMzNTg7CiAgLS1ncmVlbjogIzNmYjk1MDsgLS15ZWxsb3c6ICNkMjk5MjI7IC0tb3JhbmdlOiAjZTM4MzRhOyAtLXJlZDogI2Y4NTE0OTsKICAtLXRleHQ6ICNlNmVkZjM7IC0tdGV4dC1tdXRlZDogIzhiOTQ5ZTsgY29sb3Itc2NoZW1lOiBkYXJrOwp9CltkYXRhLXRoZW1lPSJkYXJrIl0gLm1vZGFsIHsgYmFja2dyb3VuZDogdmFyKC0tc3VyZmFjZSk7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSAubW9kYWwtb3ZlcmxheSB7IGJhY2tncm91bmQ6IHJnYmEoMCwwLDAsLjc1KTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIHNlbGVjdCxbZGF0YS10aGVtZT0iZGFyayJdIGlucHV0LFtkYXRhLXRoZW1lPSJkYXJrIl0gdGV4dGFyZWEgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gb3B0aW9uIHsgYmFja2dyb3VuZDogIzIxMjYyZDsgY29sb3I6ICNlNmVkZjM7IH0="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# codins/codin.css
$f = "$BASE\codins\codin.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7CiAgLS1iZzogIzBkMTExNzsgLS1iZzI6ICMxNjFiMjI7IC0tYmczOiAjMjEyNjJkOyAtLWJvcmRlcjogIzMwMzYzZDsgLS1ib3JkZXIyOiAjNDg0ZjU4OwogIC0tdGV4dDogI2U2ZWRmMzsgLS10ZXh0MjogIzhiOTQ5ZTsgLS10ZXh0MzogIzQ4NGY1ODsKICAtLWJsdWU6ICM1OGE2ZmY7IC0tYmx1ZS1kYXJrOiAjMzg4YmZkOyAtLWJsdWUtYmc6ICMxZjMzNTg7CiAgLS1ncmVlbjogIzNmYjk1MDsgLS1ncmVlbi1iZzogIzBkMmIxYTsgLS1yZWQ6ICNmODUxNDk7IC0tcmVkLWRhcms6ICNkYTM2MzM7IGNvbG9yLXNjaGVtZTogZGFyazsKfQpbZGF0YS10aGVtZT0iZGFyayJdIHNlbGVjdCxbZGF0YS10aGVtZT0iZGFyayJdIGlucHV0LFtkYXRhLXRoZW1lPSJkYXJrIl0gdGV4dGFyZWEgeyBiYWNrZ3JvdW5kOiB2YXIoLS1iZzMpOyBjb2xvcjogdmFyKC0tdGV4dCk7IGJvcmRlci1jb2xvcjogdmFyKC0tYm9yZGVyKTsgfQpbZGF0YS10aGVtZT0iZGFyayJdIG9wdGlvbiB7IGJhY2tncm91bmQ6ICMyMTI2MmQ7IGNvbG9yOiAjZTZlZGYzOyB9"))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# confortoprev/prev.css
$f = "$BASE\confortoprev\prev.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7CiAgLS1iZzogIzBkMTExNzsgLS1zdXJmYWNlOiAjMTYxYjIyOyAtLWJvcmRlcjogIzMwMzYzZDsgLS1ib3JkZXIyOiAjNDg0ZjU4OwogIC0tYmx1ZTogIzU4YTZmZjsgLS1ibHVlLWRhcms6ICMzODhiZmQ7IC0tYmx1ZS1iZzogIzFmMzM1ODsKICAtLWdyZWVuOiAjM2ZiOTUwOyAtLWdyZWVuLWJnOiAjMGQyYjFhOyAtLXJlZDogI2Y4NTE0OTsgLS1yZWQtYmc6ICMyYjBkMGQ7CiAgLS10ZXh0OiAjZTZlZGYzOyAtLXRleHQyOiAjOGI5NDllOyAtLXRleHQzOiAjNDg0ZjU4OyBjb2xvci1zY2hlbWU6IGRhcms7Cn0KW2RhdGEtdGhlbWU9ImRhcmsiXSBzZWxlY3QsW2RhdGEtdGhlbWU9ImRhcmsiXSBpbnB1dCxbZGF0YS10aGVtZT0iZGFyayJdIHRleHRhcmVhIHsgYmFja2dyb3VuZDogIzIxMjYyZDsgY29sb3I6IHZhcigtLXRleHQpOyBib3JkZXItY29sb3I6IHZhcigtLWJvcmRlcik7IH0KW2RhdGEtdGhlbWU9ImRhcmsiXSBvcHRpb24geyBiYWNrZ3JvdW5kOiAjMjEyNjJkOyBjb2xvcjogI2U2ZWRmMzsgfQ=="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# servicedesk/servicedesk.css
$f = "$BASE\servicedesk\servicedesk.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7IGNvbG9yLXNjaGVtZTogZGFyazsgfQpbZGF0YS10aGVtZT0iZGFyayJdIHNlbGVjdCxbZGF0YS10aGVtZT0iZGFyayJdIGlucHV0LFtkYXRhLXRoZW1lPSJkYXJrIl0gdGV4dGFyZWEgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gb3B0aW9uIHsgYmFja2dyb3VuZDogIzIxMjYyZDsgY29sb3I6ICNlNmVkZjM7IH0="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# meuschamados/meuschamados.css
$f = "$BASE\meuschamados\meuschamados.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7IGNvbG9yLXNjaGVtZTogZGFyazsgfQpbZGF0YS10aGVtZT0iZGFyayJdIHNlbGVjdCxbZGF0YS10aGVtZT0iZGFyayJdIGlucHV0LFtkYXRhLXRoZW1lPSJkYXJrIl0gdGV4dGFyZWEgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gb3B0aW9uIHsgYmFja2dyb3VuZDogIzIxMjYyZDsgY29sb3I6ICNlNmVkZjM7IH0="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# qr/qr.css
$f = "$BASE\qr\qr.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7IGNvbG9yLXNjaGVtZTogZGFyazsgfQpbZGF0YS10aGVtZT0iZGFyayJdIHNlbGVjdCxbZGF0YS10aGVtZT0iZGFyayJdIGlucHV0LFtkYXRhLXRoZW1lPSJkYXJrIl0gdGV4dGFyZWEgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gb3B0aW9uIHsgYmFja2dyb3VuZDogIzIxMjYyZDsgY29sb3I6ICNlNmVkZjM7IH0="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# login/login.css
$f = "$BASE\login\login.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7IGNvbG9yLXNjaGVtZTogZGFyazsgfQpbZGF0YS10aGVtZT0iZGFyayJdIHNlbGVjdCxbZGF0YS10aGVtZT0iZGFyayJdIGlucHV0LFtkYXRhLXRoZW1lPSJkYXJrIl0gdGV4dGFyZWEgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gb3B0aW9uIHsgYmFja2dyb3VuZDogIzIxMjYyZDsgY29sb3I6ICNlNmVkZjM7IH0="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# operador/operador.css
$f = "$BASE\operador\operador.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7IGNvbG9yLXNjaGVtZTogZGFyazsgfQpbZGF0YS10aGVtZT0iZGFyayJdIHNlbGVjdCxbZGF0YS10aGVtZT0iZGFyayJdIGlucHV0LFtkYXRhLXRoZW1lPSJkYXJrIl0gdGV4dGFyZWEgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gb3B0aW9uIHsgYmFja2dyb3VuZDogIzIxMjYyZDsgY29sb3I6ICNlNmVkZjM7IH0="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# abrir/abrir.css
$f = "$BASE\abrir\abrir.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7IGNvbG9yLXNjaGVtZTogZGFyazsgfQ=="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# codinqr/codinqr.css
$f = "$BASE\codinqr\codinqr.css"
Clean-Dark $f
$block = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("W2RhdGEtdGhlbWU9ImRhcmsiXSB7IGNvbG9yLXNjaGVtZTogZGFyazsgfQpbZGF0YS10aGVtZT0iZGFyayJdIHNlbGVjdCxbZGF0YS10aGVtZT0iZGFyayJdIGlucHV0LFtkYXRhLXRoZW1lPSJkYXJrIl0gdGV4dGFyZWEgeyBiYWNrZ3JvdW5kOiB2YXIoLS1zdXJmYWNlMik7IGNvbG9yOiB2YXIoLS10ZXh0KTsgYm9yZGVyLWNvbG9yOiB2YXIoLS1ib3JkZXIpOyB9CltkYXRhLXRoZW1lPSJkYXJrIl0gb3B0aW9uIHsgYmFja2dyb3VuZDogIzIxMjYyZDsgY29sb3I6ICNlNmVkZjM7IH0="))
$existing = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($f, $existing.TrimEnd() + "`n`n" + $block + "`n", [System.Text.Encoding]::UTF8)

# Anti-flash em todos os HTML
$antiFlash = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("PHNjcmlwdD4oZnVuY3Rpb24oKXt2YXIgdD1sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgiZXJwLXRoZW1lIik7aWYodD09PSJkYXJrIilkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2V0QXR0cmlidXRlKCJkYXRhLXRoZW1lIiwiZGFyayIpO30oKSk7PC9zY3JpcHQ+"))
Get-ChildItem -Path $BASE -Filter *.html -Recurse | ForEach-Object {
    $c = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
    $c = [regex]::Replace($c, "<script>\(function\(\)\{[^<]*erp-theme[^<]*\}\(\)\);</script>\s*", "")
    $c = $c -replace "</head>", ($antiFlash + "`n</head>")
    [System.IO.File]::WriteAllText($_.FullName, $c, [System.Text.Encoding]::UTF8)
}

# Botao tema no hub.html
$hubHtml = "$BASE\hub\hub.html"
$btnTema = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ICAgIDxidXR0b24gaWQ9ImJ0bi10ZW1hIiBvbmNsaWNrPSJ0b2dnbGVUZW1hKCkiIHN0eWxlPSJiYWNrZ3JvdW5kOm5vbmU7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6NXB4IDEwcHg7Y3Vyc29yOnBvaW50ZXI7Zm9udC1zaXplOjEzcHg7Y29sb3I6dmFyKC0tdGV4dC1tdXRlZCkiIHRpdGxlPSJBbHRlcm5hciB0ZW1hIj4mIzEyNzc2OTs8L2J1dHRvbj4KICAgIDxkaXYgY2xhc3M9InRiLXRpbWUiPg=="))
$c = [System.IO.File]::ReadAllText($hubHtml, [System.Text.Encoding]::UTF8)
if ($c -notmatch "btn-tema") {
    $c = $c -replace '    <div class="tb-time">', $btnTema
    [System.IO.File]::WriteAllText($hubHtml, $c, [System.Text.Encoding]::UTF8)
}

# toggleTema no hub.js
$hubJs = "$BASE\hub\hub.js"
$toggleFn = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("ZnVuY3Rpb24gdG9nZ2xlVGVtYSgpewogIHZhciBodG1sPWRvY3VtZW50LmRvY3VtZW50RWxlbWVudDsKICB2YXIgbm92bz1odG1sLmdldEF0dHJpYnV0ZSgnZGF0YS10aGVtZScpPT09J2RhcmsnPydsaWdodCc6J2RhcmsnOwogIGh0bWwuc2V0QXR0cmlidXRlKCdkYXRhLXRoZW1lJyxub3ZvKTsKICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnZXJwLXRoZW1lJyxub3ZvKTsKICB2YXIgYnRuPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tdGVtYScpOwogIGlmKGJ0bilidG4udGV4dENvbnRlbnQ9bm92bz09PSdkYXJrJz8nXHUyNjAwXHVmZTBmJzonXHVkODNjXHVkZjE5JzsKfQooZnVuY3Rpb24oKXsKICB2YXIgdD1sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnZXJwLXRoZW1lJyk7CiAgdmFyIGJ0bj1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXRlbWEnKTsKICBpZihidG4pYnRuLnRleHRDb250ZW50PXQ9PT0nZGFyayc/J1x1MjYwMFx1ZmUwZic6J1x1ZDgzY1x1ZGYxOSc7Cn0pKCk7"))
$c = [System.IO.File]::ReadAllText($hubJs, [System.Text.Encoding]::UTF8)
$c = [regex]::Replace($c, "(?s)`nfunction toggleTema\(\).*$", "")
if ($c -notmatch "toggleTema") {
    [System.IO.File]::WriteAllText($hubJs, $c.TrimEnd() + "`n`n" + $toggleFn + "`n", [System.Text.Encoding]::UTF8)
}

Write-Host "Dark mode aplicado com sucesso." -ForegroundColor Green

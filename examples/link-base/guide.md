# リンクと画像のパス解決の確認

`link.base`(設定モーダルの「リンクと画像のパス」)ごとに、相対パスの行き先が変わることを確かめるサンプル。

```bash
# リポジトリのルートから
bun run start -f examples/link-base/guide.md
# サブディレクトリから起動しても、gitのルートが基準になることを確かめる
cd examples && bun run ../src/index.ts -f link-base/guide.md
```

2つの基準はそれぞれ次の場所から辿る。

- ファイル基準: このファイルのあるディレクトリ(`examples/link-base/`)
- ルート基準: mdechoのリポジトリのルート

両方に実在する状況を作るため、`examples/link-base/examples/link-base/`にルート側と同じ名前のファイルを置いている。

## リンク

| # | リンク | ask(既定) | file | root |
| --- | --- | --- | --- | --- |
| 1 | [README.md](README.md) | 選択ダイアログ | `examples/link-base/README.md` | リポジトリのREADME |
| 2 | [examples/link-base/twin.md](examples/link-base/twin.md) | 選択ダイアログ | twin(ファイル基準) | twin(ルート基準) |
| 3 | [only-here.md](only-here.md) | only-here | only-here | 404 |
| 4 | [docs/getting-started.md](docs/getting-started.md) | getting-started | 404 | getting-started |
| 5 | [/docs/configuration.md](/docs/configuration.md) | configuration | configuration | configuration |
| 6 | [nowhere.md](nowhere.md) | 404 | 404 | 404 |

- 1と2は、Ctrl+クリック(新しいタブ)だとダイアログを出さずにファイル基準の方が開く
- 5は先頭が`/`なので、設定に関わらずルート基準になる
- 6は両方に無いので、askとfileではファイル基準、rootではルート基準のURLになる(どちらも404ページ)

## 画像

画像はクリックで選べないため、askで両方にあるときはルート基準を優先する。

| # | 画像 | ask(既定) | file | root |
| --- | --- | --- | --- | --- |
| 7 | `assets/file-only.svg` | 緑 | 緑 | 表示されない |
| 8 | `examples/link-base/assets/root-only.svg` | 紫 | 表示されない | 紫 |
| 9 | `examples/link-base/assets/twin.svg` | 赤(ルート基準) | 青(ファイル基準) | 赤(ルート基準) |
| 10 | `/examples/link-base/assets/root-only.svg` | 紫 | 紫 | 紫 |

7\. ファイル基準だけにある画像

![7](assets/file-only.svg)

8\. ルート基準だけにある画像

![8](examples/link-base/assets/root-only.svg)

9\. 両方にある画像

![9](examples/link-base/assets/twin.svg)

10\. 先頭が`/`の画像

![10](/examples/link-base/assets/root-only.svg)

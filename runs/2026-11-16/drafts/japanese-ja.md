---
title: 日本語学習｜2026年11月16日
date: '2026-11-16'
description: 数量の割り当てと時間間隔を区別しながら読む。
topics:
- EC2の起動完了通知
- Workersのテスト代替
- Astro移行の出力差分
- 日本語帳票の抽出評価
- Pythonの停止診断
levels:
- N2
- N1
- N5/N4
- IT/AI
vocabularyCount: 7
grammarCount: 2
vocabulary:
- term: 落ち着く
  reading: おちつく
  level: N2
  partOfSpeech: 五段・自動詞
  collocations:
  - 負荷が落ち着く
  - 事態が落ち着く
  exampleJa: アクセスが落ち着いてから、残りのデータを移します。
  meaning: 騒ぎや変動が収まり、安定した状態になる。
  note: EC2では、起動時の負荷が下がるまで時間を置いています。
  exampleMeaning: アクセスが安定してから、まだ移していないデータを移動します。
  nuance: 人の気持ちにも、負荷のような状況にも使います。
- term: 区切る
  reading: くぎる
  level: N2
  partOfSpeech: 五段・他動詞
  collocations:
  - 時間を区切る
  - 段落で区切る
  exampleJa: 作業時間を三十分で区切り、終わらなければ担当者に知らせます。
  meaning: 時間や文章に切れ目を入れ、まとまりを分ける。
  note: 待機の上限を設定し、次へ進むか失敗にするかを判断します。
  exampleMeaning: 三十分を作業の上限にして、それまでに終わらない場合は担当者へ連絡します。
  nuance: 一つの作業の区間や文の境界を決めるときに使います。
- term: 寄りかかる
  reading: よりかかる
  level: N1
  partOfSpeech: 五段・自動詞
  collocations:
  - 壁に寄りかかる
  - 特定の機能に寄りかかる
  exampleJa: 特定のブラウザの挙動に寄りかかると、移行の際に思わぬ手間がかかります。
  meaning: 物に体重を預ける。比喩では、仕組みや人に強く頼る。
  note: テスト記事では、コードが特定の実行環境の振る舞いを前提にする意味です。
  exampleMeaning: あるブラウザ特有の動きを前提にすると、移行に予想外の作業が必要になります。
  nuance: 技術の話では「依存する」に近く、頼り方を比喩的に描きます。
- term: はっきり
  reading: はっきり
  level: N5/N4
  partOfSpeech: 副詞
  collocations:
  - はっきり伝える
  - 違いがはっきりする
  exampleJa: 代替で確認できる範囲を、レビューの最初にはっきり伝えます。
  meaning: 物事の区別や意図が明確な様子。
  note: 記事では代替テストで捕まえられない失敗が明確にあると述べます。
  exampleMeaning: レビューを始めるときに、代替で分かる範囲を明確に説明します。
  nuance: 状態にも伝え方にも使えます。参考レベルはN4です。
- term: 揺れる
  reading: ゆれる
  level: N5/N4
  partOfSpeech: 一段・自動詞
  collocations:
  - 順序が揺れる
  - 気持ちが揺れる
  exampleJa: 同じ日付の記事は識別子で並べ、表示の順序が揺れないようにします。
  meaning: 振動する。また、決まっていた状態が安定しなくなる。
  note: 記事では表示の順序がビルドごとに変わり得ることを表します。
  exampleMeaning: 日付が同じ記事では識別子で並び順を決め、画面の順番を安定させます。
  nuance: 物理的な動きのほか、順序や判断の変動にも使えます。参考レベルはN4です。
- term: 途絶える
  reading: とだえる
  level: N2
  partOfSpeech: 一段・自動詞
  collocations:
  - 通信が途絶える
  - 記録が途絶える
  exampleJa: 通信が途絶えた時刻を記録し、復帰までの時間を測ります。
  meaning: それまで続いていた流れが、途中で止まる。
  note: 監視の予約のかけ直しが来なくなる状況です。
  exampleMeaning: 通信が切れた時刻から、再びつながるまでの長さを調べます。
  nuance: 通信や連絡など、続いていたものが止まるときに使います。
- term: 残す
  reading: のこす
  level: N5/N4
  partOfSpeech: 五段・他動詞
  collocations:
  - 証拠を残す
  - 経過を残す
  exampleJa: 測った値とそのときの条件を、後で読める形で残します。
  meaning: 物や情報を、後から使えるようにそのままにする。
  note: 原因を調べられるよう、停止時や復帰時の情報を保存します。
  exampleMeaning: 測定値と条件を、後から参照できる形にして保存します。
  nuance: 記録の文脈では何を保存したかを「を」で示します。参考レベルはN4です。
grammar:
- pattern: ～につき
  level: N2
  sourceUrl: https://zenn.dev/miyakona/articles/ec2-replacement-waits-for-user-data
  sourceForm: 1台につき
  sourceAnchor: 1台につき成功通知を1件待ち
  exampleJa: 作業者一人につき、一枚の入館証を用意します。
  meaning: 単位を一つ決めて、それぞれに割り当てる数量を表す。
  structure: 数量名詞 ＋ につき ＋ 数量
  usage: 料金、上限、配布数などを説明する。
  exampleMeaning: 作業者それぞれに一枚ずつ入館証を準備します。
  note: ここでは「一人当たり」の意味です。「工事中につき」の原因用法とは接続後の働きが違います。
- pattern: ～ごとに
  level: N5/N4
  sourceUrl: https://zenn.dev/itaraiguma/articles/faulthandler-stall-watchdog-segfault
  sourceForm: 1秒ごとに
  sourceAnchor: 1秒ごとに「3秒後にスタックを出す」予約をかけ直し
  exampleJa: 五分ごとに、処理待ちの件数を集計します。
  meaning: 一定の区切りが来るたび、同じことを繰り返す。
  structure: 時間・距離などの名詞 ＋ ごとに
  usage: 同じ幅の間隔を指定する場合に使う。
  exampleMeaning: 五分間隔で未処理の件数を数えます。
  note: 時間の名詞に直接つながります。「時間が経つたびに」のような節を作らず間隔を示せます。参考レベルはN4です。
mustRememberWords:
- 落ち着く
- 区切る
- 寄りかかる
- はっきり
- 揺れる
- 途絶える
- 残す
mustRememberGrammar:
- ～につき
- ～ごとに
grammarSelectionNote: 全96日分の既出用法と照合しました。原文の数量配分と時間間隔から、別々の働きを持つ新規文型2項目を選び、復習は別に扱います。
technicalTerms:
- term: CreationPolicy
  japanese: 作成ポリシー
  meaning: 指定数の成功通知を受けてから作成を完了させる条件。
  context: EC2のuser dataの結果を待ちます。
- term: Elastic IP
  japanese: 固定パブリックIP
  meaning: 別のインスタンスへ関連付けを変更できる固定IP。
  context: 新しい台の準備後に関連付けを切り替えます。
- term: D1 prepared statement
  japanese: D1の準備済み文
  meaning: SQLを準備し、値を後から渡して実行する呼び出し。
  context: 代替で bind の引数を記録します。
- term: multipart upload
  japanese: マルチパートアップロード
  meaning: オブジェクトを分割して送り、受理済みのパートを確定する操作。
  context: R2の代替で順序とパートの抜けを調べます。
- term: lightningcss
  japanese: CSSの変換・圧縮器
  meaning: CSSの構文を読み取り、変換や圧縮を行う処理系。
  context: Astroのビルドで不正なセレクターを検出しました。
- term: exact match
  japanese: 完全一致
  meaning: 出力値が定義された正解と一致した場合を数える指標。
  context: 型を通った場合でも別に集計します。
- term: GIL
  japanese: グローバルインタープリターロック
  meaning: 対象のCPythonでPythonコードの実行を同期するロック。
  context: 置換後の監視スレッドは取得後にフレームを読みます。
---

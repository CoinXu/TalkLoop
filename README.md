不只是“词汇表 + 句子数据”就够。它们是核心素材，但要让产品闭环跑起来，还需要这些资料/配置：

  最少可跑闭环

  1. 词频源：你现在已有 SUBTLEXus，可以导入到 subtlexus_words。
  2. 学习词条：需要从 SUBTLEXus 生成 word_entries，并补齐：
      - 中文释义 meaningCn
      - 英文释义 meaningEn
      - 音标 phonetic
      - 音频地址 audioUrl
      - audioStatus=ready
      - reviewStatus=approved
      - publishStatus=published
  3. 句子数据：不只是句子文本，还要有：
      - 英文句子 sentenceText
      - 中文翻译 translationCn
      - 普通音频 normalAudioUrl
      - 慢速音频 slowAudioUrl 可选但推荐
      - audioStatus=ready
      - targetWords
      - difficultyLevel
      - reviewStatus=approved
      - publishStatus=published
  4. 场景和课程：
      - corpus_scenes
      - courses
      - 句子要挂到 scene/course，听读和课程报告才有结构。

  练习质量需要补的资料
  5. 词条学习素材：

  - hearingTrap
  - commonCollocations
  - distractors.pronunciation
  - distractors.meaning
  - distractors.difficulty

  这些不是必须启动，但会影响选择题、听力陷阱、激活练习质量。

  用户初始化需要的配置
  6. 评估配置：

  - active 的 assessment config
  - 自评题、估算矩阵、抽样策略
    没有也能 fallback，但产品体验会弱。

  7. 每日任务策略：
      - active 的 daily task strategy
        没有也会 fallback 到 default-v1.0，但最好配。
  8. 练习规则：
      - active 的 practice rule
        目前状态转换有默认逻辑，但后台规则最好补上。

  所以你的判断可以改成：

  “有词频表 + 句子数据”只是素材源；真正能让学习端跑起来，至少还要把一批词条补齐释义/音频并发布，再把一批句子补齐音频/
  目标词并发布。

  推荐下一步顺序：

  1. 导入 SUBTLEXus。
  2. 从 SUBTLEXus 创建一批学习词条草稿。
  3. 批量补词条释义、音频、干扰项并发布。
  4. 导入场景、课程、句子、音频、targetWords 并发布。
  5. 配 active assessment / daily task / practice rule。
  6. 注册用户后做自评，生成用户词库，再测每日任务。


  1. 句子管理 API

  后端其实已经有基础管理 API，但它不完整：

  - GET /admin/corpus/sentences
  - POST /admin/corpus/sentences
  - PATCH /admin/corpus/sentences/:id

  位置在 services/api/src/http/routes/LearningActivationRoutes.ts:178。

  但你说“没有管理 API”也有道理，因为现在缺这些真正后台会需要的能力：

  - 批量导入 API
  - 批量发布/下架/审核
  - 批量分配场景、课程、排序
  - 删除/归档 API
  - 按 targetWord、sceneTag、是否已分配课程、是否有音频等更完整筛选
  - 课程内句子排序/移动 API
  - 句子详情 API

  当前只是 CRUD 的最低版本。

  2. 场景、课程、句子怎么设计

  现有模型是：

  - corpus_scenes：场景，比如 Daily Conversation、Restaurant、Workplace
  - courses：课程，必须属于一个场景，比如 Restaurant L1 - Ordering Food
  - corpus_sentences：句子，可关联 sceneId 和 courseId

  关系是：

  Scene 1 --- N Course
  Course 1 --- N Sentence
  Scene 1 --- N Sentence

  句子关联课程时，应同时写：

  - sceneId = course.sceneId
  - courseId = selectedCourseId
  - sortOrder = 课程内顺序

  现在导入的 70,760 条句子还没有场景和课程归属，sceneId/courseId = null。所以它们能作为“句子池”使用，但还不是
  课程体系。

  管理前端建议做 3 层：

  - 场景管理：列表、新建、编辑、发布状态。
  - 课程管理：按场景展示课程，新建课程，设置 level、描述、发布状态、解锁规则。
  - 句子池 + 课程编排：
      - 左侧句子池：筛选难度、目标词、关键词、未分配/已分配、sceneTag。
      - 右侧课程句子列表：8-12 句，支持添加、移除、拖拽排序。
      - 发布前校验：句子数、音频、审核状态、难度一致性、目标词是否为空。

  3. 这些数据完成后功能完成了吗？

  没有。数据只是把“句子池”准备好了，功能还没完整完成。

  还缺的关键工作：

  - 生成或维护真实场景、课程数据。
  - 把句子分配到课程，并排序。
  - 后端补批量管理 API，尤其是批量分配课程和课程内排序。
  - 管理前端做场景/课程/句子编排界面。
  - 真实音频替换，现在是开发假音频。
  - 自动标注质量还要提升，targetWords/phraseChunks/difficultyLevel 目前是启发式。
  - 课程发布校验和前端提示要完善。
  - 学习端要按场景 -> 课程 -> 句子完整串起来验证。

  当前状态更准确地说是：句子基础数据已导入，可供开发联调；课程化内容生产和管理闭环还没完成。
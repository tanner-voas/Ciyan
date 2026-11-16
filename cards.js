// Starter deck. Add more cards through the app's editor or an imported deck JSON.
export const STARTER_CARDS = [
  ['你好','nǐ hǎo','Hello','你好！今天怎么样？','Nǐ hǎo! Jīntiān zěnmeyàng?','Hi! How is today going?','greetings,basics'],
  ['谢谢','xièxie','Thank you','谢谢你帮我。','Xièxie nǐ bāng wǒ.','Thanks for helping me.','greetings,basics'],
  ['不好意思','bù hǎoyìsi','Excuse me; sorry','不好意思，打扰一下。','Bù hǎoyìsi, dǎrǎo yíxià.','Excuse me, can I interrupt for a moment?','greetings,social'],
  ['没关系','méi guānxi',"It's okay; no problem",'没关系，慢慢来。','Méi guānxi, mànman lái.',"No problem, take your time.",'greetings,social'],
  ['最近','zuìjìn','Recently; lately','你最近忙吗？','Nǐ zuìjìn máng ma?','Have you been busy lately?','social,time'],
  ['周末','zhōumò','Weekend','周末有什么计划？','Zhōumò yǒu shénme jìhuà?','Any plans for the weekend?','social,time'],
  ['约','yuē','To arrange to meet','我们下周约个时间吧。','Wǒmen xià zhōu yuē ge shíjiān ba.',"Let's find a time to meet next week.",'social'],
  ['方便','fāngbiàn','Convenient','你现在方便说话吗？','Nǐ xiànzài fāngbiàn shuōhuà ma?','Is now a convenient time to talk?','social,work'],
  ['随便','suíbiàn','Whatever; any is fine','吃什么？我都随便。','Chī shénme? Wǒ dōu suíbiàn.','What should we eat? Anything is fine with me.','social,food'],
  ['当然','dāngrán','Of course','当然可以！','Dāngrán kěyǐ!','Of course you can!','basics,social'],
  ['有点儿','yǒudiǎnr','A little (often negative)','今天有点儿累。','Jīntiān yǒudiǎnr lèi.',"I'm a little tired today.",'basics'],
  ['差不多','chàbuduō','Almost; about the same','我们差不多到了。','Wǒmen chàbuduō dào le.',"We're almost there.",'basics,time'],
  ['打算','dǎsuàn','To plan; intend','我打算周末去爬山。','Wǒ dǎsuàn zhōumò qù páshān.','I plan to go hiking this weekend.','social,time'],
  ['感觉','gǎnjué','To feel; feeling','我感觉这个不错。','Wǒ gǎnjué zhège búcuò.','I feel this one is pretty good.','social,basics'],
  ['推荐','tuījiàn','To recommend','你有什么推荐的餐厅？','Nǐ yǒu shénme tuījiàn de cāntīng?','Do you have any restaurant recommendations?','food,social'],
  ['点菜','diǎncài','To order food','我们先点菜吧。','Wǒmen xiān diǎncài ba.',"Let's order first.",'food,restaurant'],
  ['菜单','càidān','Menu','可以给我看一下菜单吗？','Kěyǐ gěi wǒ kàn yíxià càidān ma?','May I see the menu?','food,restaurant,reading'],
  ['打包','dǎbāo','To pack food to go','剩下的可以打包吗？','Shèngxià de kěyǐ dǎbāo ma?','Can I take the leftovers to go?','food,restaurant'],
  ['微辣','wēilà','Mildly spicy','我要微辣的。','Wǒ yào wēilà de.',"I'll have it mildly spicy.",'food,restaurant,reading'],
  ['加班','jiābān','To work overtime','我今天可能要加班。','Wǒ jīntiān kěnéng yào jiābān.','I might have to work overtime today.','work'],
  ['开会','kāihuì','To have a meeting','我下午三点要开会。','Wǒ xiàwǔ sān diǎn yào kāihuì.','I have a meeting at 3 p.m.','work,time'],
  ['进度','jìndù','Progress; status','项目进度怎么样？','Xiàngmù jìndù zěnmeyàng?','How is the project coming along?','work'],
  ['问题','wèntí','Question; problem','这个问题不太好解决。','Zhège wèntí bú tài hǎo jiějué.','This problem is not easy to solve.','work,basics'],
  ['解决','jiějué','To solve; resolve','我们一起想办法解决。','Wǒmen yìqǐ xiǎng bànfǎ jiějué.',"Let's find a way to solve it together.",'work'],
  ['地铁','dìtiě','Subway; metro','坐地铁比打车快。','Zuò dìtiě bǐ dǎchē kuài.','The subway is faster than taking a taxi.','city,transport'],
  ['换乘','huànchéng','To transfer (transport)','在这里换乘四号线。','Zài zhèlǐ huànchéng sì hào xiàn.','Transfer to Line 4 here.','city,transport,reading'],
  ['附近','fùjìn','Nearby','这附近有咖啡店吗？','Zhè fùjìn yǒu kāfēidiàn ma?','Is there a coffee shop nearby?','city'],
  ['排队','páiduì','To queue; line up','这里要排队多久？','Zhèlǐ yào páiduì duōjiǔ?','How long is the queue here?','city,restaurant'],
  ['攀岩','pānyán','Rock climbing','我每周去攀岩两次。','Wǒ měi zhōu qù pānyán liǎng cì.','I go climbing twice a week.','hobbies'],
  ['抱石','bàoshí','Bouldering','你喜欢抱石还是绳攀？','Nǐ xǐhuan bàoshí háishì shéngpān?','Do you prefer bouldering or rope climbing?','hobbies'],
  ['难度','nándù','Difficulty level','这条路线难度有点高。','Zhè tiáo lùxiàn nándù yǒudiǎn gāo.','This route is a bit difficult.','hobbies'],
  ['坚持','jiānchí','To persist; keep at it','每天坚持练习很重要。','Měitiān jiānchí liànxí hěn zhòngyào.','Practicing consistently every day is important.','hobbies,basics'],
];

export function initialCards() {
  return STARTER_CARDS.map(([hanzi,pinyin,english,example,examplePinyin,exampleEnglish,tags],i) => ({
    id: `starter-${String(i+1).padStart(3,'0')}`, hanzi, pinyin, english,
    tags: tags.split(','), source: 'Starter Mandarin', createdAt: '2026-11-16T00:00:00.000Z'
  }));
}

// Minimal words needed to make the starter grammar puzzles usable after review.
const PUZZLE_WORDS = [
 ['吃','chī','To eat','food,basics'],['什么','shénme','What','basics'],
 ['我','wǒ','I; me','basics'],['都','dōu','All; both; in any case','grammar,basics'],
 ['多','duō','Many; much','basics'],['你','nǐ','You','basics'],
 ['现在','xiànzài','Now','time,basics'],['有','yǒu','To have; there is','basics'],
 ['时间','shíjiān','Time (duration or availability)','time'],['时候','shíhou','Time; occasion; moment','time'],
 ['吗','ma','Question particle','grammar,basics'],['想','xiǎng','To want; think','basics'],
 ['去','qù','To go','basics'],['但是','dànshì','But; however','grammar'],
 ['今天','jīntiān','Today','time'],['要','yào','To need; want; going to','basics'],
 ['会','huì','Can; will; know how to','grammar'],['已经','yǐjīng','Already','time,grammar'],
 ['了','le','Completion/change particle','grammar'],['还','hái','Still; yet','grammar,time']
];
export function extraWords() {
 return PUZZLE_WORDS.map(([hanzi,pinyin,english,tags],i)=>({
   id:`puzzle-${String(i+1).padStart(3,'0')}`,hanzi,pinyin,english,tags:tags.split(','),source:'Starter grammar vocabulary',createdAt:'2026-11-16T00:00:00.000Z'
 }));
}
